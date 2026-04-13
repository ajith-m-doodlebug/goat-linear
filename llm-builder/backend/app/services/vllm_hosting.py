import os
import shlex
import shutil
import subprocess
import time
from pathlib import Path
from urllib.parse import urlparse

import httpx

from app.core.config import get_settings
from app.models.host_model_instance import HostModelInstance


def _docker_cmd() -> str:
    return (get_settings().host_models_docker_cmd or "docker").strip() or "docker"


def _resolved_docker_executable() -> str | None:
    """Return a usable docker (or podman) binary path, or None.

    Host models shell out to the CLI against a mounted Docker socket. Some
    runtimes ship the binary under a standard path but not on a minimal PATH.
    """
    cmd = _docker_cmd()
    if os.path.isabs(cmd) and os.path.isfile(cmd) and os.access(cmd, os.X_OK):
        return cmd
    found = shutil.which(cmd)
    if found:
        return found
    if os.sep not in cmd and cmd == "docker":
        for candidate in ("/usr/bin/docker", "/usr/local/bin/docker"):
            if os.path.isfile(candidate) and os.access(candidate, os.X_OK):
                return candidate
    return None


def _docker_cli_missing_message(cmd: str) -> str:
    if os.path.isabs(cmd):
        if not os.path.isfile(cmd):
            return (
                f"No Docker CLI at {cmd} inside this process (paths are inside the API container, "
                "not the host). Rebuild the app image with a Docker client, or set HOST_MODELS_DOCKER_CMD "
                "to a binary that exists in that same container."
            )
        if not os.access(cmd, os.X_OK):
            return f"Docker CLI exists but is not executable: {cmd}"
    return (
        f"Docker CLI not found: {cmd}. Install the client in the API image, or set HOST_MODELS_DOCKER_CMD "
        "to an executable path inside the container."
    )


def _docker_bin() -> str:
    exe = _resolved_docker_executable()
    if exe is None:
        raise RuntimeError(_docker_cli_missing_message(_docker_cmd()))
    return exe


def _image() -> str:
    return get_settings().host_models_vllm_image


def _public_base_url() -> str:
    return get_settings().host_models_public_base_url.rstrip("/")


def _client_facing_base_url(instance: HostModelInstance) -> str:
    """URL shown for clients / model registry. May use ingress port while the container uses instance.port."""
    settings = get_settings()
    raw = (settings.host_models_public_base_url or "http://localhost").strip().rstrip("/")
    p = urlparse(raw)
    if p.port is not None:
        return raw
    reg = settings.host_models_register_http_port
    port = int(reg) if reg is not None else instance.port
    return f"{raw}:{port}"


def client_facing_base_url(instance: HostModelInstance) -> str:
    """Public endpoint base shown in UI / used for model registry rows."""
    return _client_facing_base_url(instance)


def _hf_cache_dir() -> str:
    return get_settings().host_models_hf_cache_dir.strip()


def _run(cmd: list[str]) -> str:
    res = subprocess.run(cmd, capture_output=True, text=True)
    if res.returncode != 0:
        raise RuntimeError((res.stderr or res.stdout or "command failed").strip())
    return (res.stdout or "").strip()


def _docker_socket_path() -> str:
    return "/var/run/docker.sock"


def _ensure_docker_available() -> None:
    docker = _docker_bin()
    _run([docker, "version", "--format", "{{.Server.Version}}"])
    settings = get_settings()
    if settings.host_models_require_docker_socket and os.path.exists("/.dockerenv"):
        if not os.path.exists(_docker_socket_path()):
            raise RuntimeError(
                "Docker socket not mounted. Mount /var/run/docker.sock into app container."
            )


def _parse_gpu_ids(raw: str) -> list[int]:
    values = [x.strip() for x in (raw or "").split(",") if x.strip()]
    if not values:
        return [0]
    ids: list[int] = []
    for v in values:
        if not v.isdigit():
            raise RuntimeError("GPU IDs must be comma-separated integers (e.g. 0 or 0,1)")
        ids.append(int(v))
    return ids


def validate_instance_config(instance: HostModelInstance) -> None:
    _ensure_docker_available()
    gpu_ids = _parse_gpu_ids(instance.gpu_ids)
    if instance.tensor_parallel_size > len(gpu_ids):
        raise RuntimeError("Tensor parallel size cannot exceed number of GPU IDs")
    hf_cache = _hf_cache_dir()
    if hf_cache and not hf_cache.startswith("/"):
        raise RuntimeError("HF cache dir must be an absolute host path")


def _container_name(instance_id: str) -> str:
    return f"llmbuilder-vllm-{instance_id[:8]}"


def _safe_model_mount_name(model_ref: str) -> str:
    return "".join(ch if ch.isalnum() else "_" for ch in model_ref)[:64] or "model"


def _container_mount_suffix(model_ref: str) -> str:
    """In-container path segment under /models/ (e.g. sarvam-30b for /data/models/sarvam-30b)."""
    m = (model_ref or "").strip()
    if m.startswith("/"):
        base = Path(m).name
        if base:
            safe = "".join(ch if ch.isalnum() or ch in "-._" else "_" for ch in base)[:64]
            return safe or "model"
    return _safe_model_mount_name(model_ref)


def ensure_gpu_available() -> None:
    _ensure_docker_available()
    docker = _docker_bin()
    _run(
        [
            docker,
            "run",
            "--rm",
            "--gpus",
            "all",
            "nvidia/cuda:12.1.1-base-ubuntu22.04",
            "nvidia-smi",
        ]
    )


def _build_run_cmd(instance: HostModelInstance) -> list[str]:
    docker = _docker_bin()
    container_name = _container_name(instance.id)
    cmd = [
        docker,
        "run",
        "-d",
        "--name",
        container_name,
        "--restart",
        "unless-stopped",
        "--gpus",
        f"device={instance.gpu_ids}",
        "-p",
        f"{instance.port}:8000",
    ]

    hf_cache = _hf_cache_dir()
    if hf_cache:
        cmd.extend(["-v", f"{hf_cache}:/root/.cache/huggingface"])

    local_path = Path(instance.model_ref).expanduser().resolve()
    mount_name = _container_mount_suffix(instance.model_ref)
    model_arg = f"/models/{mount_name}"
    cmd.extend(["-v", f"{str(local_path)}:{model_arg}:ro"])

    # Matches working manual invocations: ENTRYPOINT overridden with python3 + api_server + --model.
    cmd.extend(["--entrypoint", "python3"])
    cmd.append(_image())
    cmd.extend(
        [
            "-m",
            "vllm.entrypoints.openai.api_server",
            "--model",
            model_arg,
            "--host",
            "0.0.0.0",
            "--port",
            "8000",
            "--served-model-name",
            instance.served_model_name,
            "--tensor-parallel-size",
            str(instance.tensor_parallel_size),
        ]
    )

    cfg = instance.config or {}
    if cfg.get("gpu_memory_utilization") is not None:
        cmd.extend(["--gpu-memory-utilization", str(cfg.get("gpu_memory_utilization"))])
    if cfg.get("max_model_len") is not None:
        cmd.extend(["--max-model-len", str(cfg.get("max_model_len"))])
    if cfg.get("dtype"):
        cmd.extend(["--dtype", str(cfg.get("dtype"))])
    if instance.api_key:
        cmd.extend(["--api-key", instance.api_key])
    # HF-style local trees (e.g. Sarvam) almost always ship modeling code; vLLM requires this flag.
    cmd.append("--trust-remote-code")
    if cfg.get("enforce_eager"):
        cmd.append("--enforce-eager")
    return cmd


def start_instance(instance: HostModelInstance) -> tuple[str, str]:
    remove_container(instance.id)
    cmd = _build_run_cmd(instance)
    container_id = _run(cmd)
    base_url = _client_facing_base_url(instance)
    return container_id, base_url


def stop_instance(instance: HostModelInstance) -> None:
    docker = _docker_bin()
    name = _container_name(instance.id)
    _run([docker, "stop", name])


def remove_container(instance_id: str) -> None:
    exe = _resolved_docker_executable()
    if not exe:
        return
    name = _container_name(instance_id)
    for slug in (name, f"/{name}"):
        subprocess.run([exe, "rm", "-f", slug], capture_output=True, text=True)
    res = subprocess.run(
        [exe, "ps", "-a", "--no-trunc", "--format", "{{.ID}}\t{{.Names}}"],
        capture_output=True,
        text=True,
    )
    for line in (res.stdout or "").splitlines():
        parts = line.strip().split("\t", 1)
        if len(parts) != 2:
            continue
        cid, raw_name = parts[0], parts[1].strip()
        base = raw_name.lstrip("/")
        if base == name:
            subprocess.run([exe, "rm", "-f", cid], capture_output=True, text=True)


def fetch_logs(instance: HostModelInstance, tail: int = 200) -> str:
    docker = _docker_bin()
    name = _container_name(instance.id)
    res = subprocess.run(
        [docker, "logs", "--tail", str(tail), name],
        capture_output=True,
        text=True,
    )
    if res.returncode != 0:
        err = (res.stderr or res.stdout or "").strip()
        if "no such container" in err.lower():
            return (
                f"No Docker container {name!r} (vLLM may not have started, exited and was removed, or start never succeeded). "
                f"Check the instance health_message, try Start, or on the host run: docker ps -a --filter name={name}\n"
                f"Docker: {err}"
            )
        raise RuntimeError(err or "docker logs failed")
    return (res.stdout or "")[-10000:]


def _vllm_health_url(instance: HostModelInstance) -> str:
    """URL for GET /health. Inside the API container, public HOST_MODELS_PUBLIC_BASE_URL:port often
    cannot hairpin to the host; use host.docker.internal (requires compose extra_hosts) or override."""
    settings = get_settings()
    custom = (settings.host_models_health_probe_base_url or "").strip().rstrip("/")
    if custom:
        return f"{custom}:{instance.port}/health"
    if os.path.exists("/.dockerenv"):
        return f"http://host.docker.internal:{instance.port}/health"
    return f"{instance.base_url.rstrip('/')}/health"


def vllm_endpoint_connect_base(endpoint_url: str | None) -> str | None:
    """Base URL for server-side HTTP from the API to vLLM (chat, /health in model registry).

    Browsers and external clients should keep using the public URL. When the API runs in Docker
    and vLLM is published on the same host, calling the host's public IP (or localhost on the host)
    from inside the container often fails (hairpin / wrong loopback); route via host.docker.internal
    or HOST_MODELS_HEALTH_PROBE_BASE_URL instead. Remote vLLM hosts are unchanged."""
    if not endpoint_url:
        return endpoint_url
    base = endpoint_url.strip().rstrip("/")
    if not os.path.exists("/.dockerenv"):
        return base
    p = urlparse(base)
    if p.scheme not in ("http", "https"):
        return base
    port = p.port
    if port is None:
        port = 443 if p.scheme == "https" else 80
    host = (p.hostname or "").lower()
    settings = get_settings()
    pub = urlparse((settings.host_models_public_base_url or "http://localhost").strip())
    pub_h = (pub.hostname or "").lower() if pub.hostname else ""
    colocated = host in ("localhost", "127.0.0.1", "::1") or (bool(pub_h) and host == pub_h)
    if not colocated:
        return base
    custom = (settings.host_models_health_probe_base_url or "").strip().rstrip("/")
    if custom:
        ih = urlparse(custom if "://" in custom else f"http://{custom}")
        new_host = ih.hostname or "host.docker.internal"
    else:
        new_host = "host.docker.internal"
    return f"{p.scheme}://{new_host}:{port}"


def check_health(instance: HostModelInstance, *, read_timeout: float = 20.0) -> tuple[bool, str]:
    url = _vllm_health_url(instance)
    try:
        t = httpx.Timeout(read_timeout, connect=10.0)
        with httpx.Client(timeout=t) as client:
            r = client.get(url)
        if r.status_code == 200:
            return True, "healthy"
        return False, f"health endpoint returned {r.status_code}"
    except Exception as e:
        return False, str(e)


def wait_for_health_ready(instance: HostModelInstance) -> tuple[bool, str]:
    """Poll vLLM /health until success or HOST_MODELS_HEALTH_TIMEOUT_SECONDS elapses."""
    settings = get_settings()
    max_wait = max(30, int(settings.host_models_health_timeout_seconds))
    interval = 5
    deadline = time.monotonic() + max_wait
    last_msg = ""
    while time.monotonic() < deadline:
        ok, msg = check_health(instance, read_timeout=25.0)
        last_msg = msg
        if ok:
            return True, msg
        time.sleep(interval)
    return False, last_msg or "no response"


def get_instance_endpoint(instance: HostModelInstance) -> str:
    return f"{instance.base_url.rstrip('/')}/v1/chat/completions"


def debug_command_preview(instance: HostModelInstance) -> str:
    return shlex.join(_build_run_cmd(instance))


def validate_local_path(instance: HostModelInstance) -> None:
    if instance.model_source != "local_path":
        raise RuntimeError(
            "Hugging Face repo hosting was removed. Delete this instance and create a host model "
            "with an absolute path to a model directory on the Docker host."
        )
    raw = (instance.model_ref or "").strip()
    model_path = os.path.normpath(os.path.expanduser(raw))
    if not os.path.isabs(model_path):
        raise RuntimeError("Local model path must be absolute")
    local_prefix = (get_settings().host_models_local_path_prefix or "").strip()
    if local_prefix:
        prefix_norm = os.path.normpath(os.path.expanduser(local_prefix.rstrip("/")))
        if model_path != prefix_norm and not model_path.startswith(prefix_norm + os.sep):
            raise RuntimeError(f"Local model path must be under {local_prefix}")

    # API often runs in a container without the host model tree mounted; vLLM still bind-mounts
    # from the Docker *host* at start time. Only assert existence when we see the host FS.
    if os.path.exists("/.dockerenv"):
        return
    p = Path(model_path)
    if not p.exists():
        raise RuntimeError(f"Local model path does not exist: {p}")
    if not os.access(p, os.R_OK):
        raise RuntimeError(f"Local model path is not readable: {p}")


def preflight_status() -> dict:
    settings = get_settings()
    checks: dict[str, dict[str, str | bool]] = {}

    docker_cmd = _docker_cmd()
    docker_exe = _resolved_docker_executable()
    cli_ok = docker_exe is not None
    checks["docker_cli"] = {
        "ok": cli_ok,
        "message": (f"Docker CLI found ({docker_exe})" if cli_ok else _docker_cli_missing_message(docker_cmd)),
    }

    daemon_ok = False
    daemon_msg = "Skipped: docker CLI missing"
    if cli_ok and docker_exe:
        try:
            version = _run([docker_exe, "version", "--format", "{{.Server.Version}}"])
            daemon_ok = True
            daemon_msg = f"Docker daemon reachable (server {version})"
        except Exception as e:
            daemon_msg = f"Docker daemon not reachable: {e}"
    checks["docker_daemon"] = {"ok": daemon_ok, "message": daemon_msg}

    socket_required = settings.host_models_require_docker_socket and os.path.exists("/.dockerenv")
    socket_ok = True
    socket_msg = "Docker socket check not required"
    if socket_required:
        socket_ok = os.path.exists(_docker_socket_path())
        socket_msg = (
            "Docker socket mounted"
            if socket_ok
            else "Docker socket missing. Mount /var/run/docker.sock into app container."
        )
    checks["docker_socket"] = {"ok": socket_ok, "message": socket_msg}

    hf_cache = _hf_cache_dir()
    hf_ok = bool(hf_cache) and hf_cache.startswith("/")
    hf_msg = (
        "vLLM HF cache mount path is absolute (optional hub/tokenizer cache)"
        if hf_ok
        else "HF cache dir must be an absolute host path (for optional vLLM cache volume)"
    )
    checks["hf_cache_dir"] = {"ok": hf_ok, "message": hf_msg, "value": hf_cache}

    gpu_ok = False
    gpu_msg = "Skipped: docker not ready"
    if cli_ok and daemon_ok and docker_exe:
        try:
            ensure_gpu_available()
            gpu_ok = True
            gpu_msg = "GPU runtime available"
        except Exception as e:
            gpu_msg = f"GPU runtime unavailable: {e}"
    checks["gpu_runtime"] = {"ok": gpu_ok, "message": gpu_msg}

    all_ok = all(bool(c.get("ok")) for c in checks.values())
    any_ok = any(bool(c.get("ok")) for c in checks.values())
    level = "green" if all_ok else ("yellow" if any_ok else "red")
    return {"level": level, "checks": checks}
