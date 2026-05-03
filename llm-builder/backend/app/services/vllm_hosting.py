import os
import re
import shlex
import shutil
import subprocess
import time
from pathlib import Path
from typing import NamedTuple

from urllib.parse import urlparse

import httpx

from app.core.config import get_settings
from app.models.host_model_instance import HostModelInstance


class _LlamaCppMount(NamedTuple):
    volume_args: list[str]
    model_container_path: str


def _running_in_container() -> bool:
    return os.path.exists("/.dockerenv")


_SPLIT_GGUF_NAME = re.compile(r"-\d+-of-\d+\.gguf$", re.IGNORECASE)


def _is_split_gguf_filename(filename: str) -> bool:
    """True if basename matches llama.cpp split naming (e.g. foo-00001-of-00009.gguf)."""
    return bool(filename and _SPLIT_GGUF_NAME.search(filename))


def _split_shard_part_index(filename: str) -> int | None:
    """Return shard index N from ...-N-of-M.gguf, or None if not a split name."""
    m = re.search(r"-(\d+)-of-\d+\.gguf$", filename, re.IGNORECASE)
    if not m:
        return None
    return int(m.group(1))


def _pick_llamacpp_entry_gguf_basename(filenames: list[str], cfg_gguf: str) -> str:
    """Pick which .gguf llama-server should open (split sets: prefer unique *-00001-of-*.gguf)."""
    cfg = (cfg_gguf or "").strip()
    ggufs = sorted(n for n in filenames if n.lower().endswith(".gguf"))
    if cfg:
        if cfg not in ggufs:
            raise RuntimeError(
                f"llamacpp_gguf {cfg!r} not found in model directory ({len(ggufs)} .gguf file(s) present)"
            )
        return cfg
    first_shards = [n for n in ggufs if _split_shard_part_index(n) == 1]
    if len(first_shards) == 1:
        return first_shards[0]
    if len(ggufs) == 1:
        return ggufs[0]
    if not ggufs:
        raise RuntimeError("No .gguf files in model directory")
    if len(first_shards) > 1:
        raise RuntimeError(
            "Multiple first-shard GGUF files (*-00001-of-*.gguf); set GGUF filename (config llamacpp_gguf)."
        )
    raise RuntimeError(
        "Multiple .gguf files with no unique first split shard; remove extras, merge, or set llamacpp_gguf."
    )


def _docker_list_host_dir_basenames(host_abs_dir: str) -> list[str]:
    """List filenames on the Docker host using docker run + bind-mount (API may not see host paths)."""
    host_abs_dir = os.path.normpath(host_abs_dir)
    if not host_abs_dir.startswith("/"):
        raise RuntimeError("Model directory must be an absolute host path")
    img = (get_settings().host_models_docker_ls_image or "").strip() or "busybox:latest"
    exe = _docker_bin()
    res = subprocess.run(
        [
            exe,
            "run",
            "--rm",
            "-v",
            f"{host_abs_dir}:/__ragline_ls:ro",
            img,
            "ls",
            "-1",
            "/__ragline_ls",
        ],
        capture_output=True,
        text=True,
        timeout=120,
    )
    if res.returncode != 0:
        err = (res.stderr or res.stdout or "").strip()
        raise RuntimeError(
            f"Could not list host directory {host_abs_dir!r} via Docker ({img}). "
            f"Pull the image or set HOST_MODELS_DOCKER_LS_IMAGE. {err}"
        )
    return [ln.strip() for ln in (res.stdout or "").splitlines() if ln.strip()]


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


def _llamacpp_image() -> str:
    return (get_settings().host_models_llamacpp_image or "").strip() or "ghcr.io/ggml-org/llama.cpp:server-cuda"


def _engine(instance: HostModelInstance) -> str:
    return (instance.engine or "vllm").strip().lower()


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
    if _engine(instance) == "vllm" and instance.tensor_parallel_size > len(gpu_ids):
        raise RuntimeError("Tensor parallel size cannot exceed number of GPU IDs")
    hf_cache = _hf_cache_dir()
    if hf_cache and not hf_cache.startswith("/"):
        raise RuntimeError("HF cache dir must be an absolute host path")


def _container_name(instance: HostModelInstance) -> str:
    short = instance.id[:8]
    return f"llmbuilder-llamacpp-{short}" if _engine(instance) == "llama_cpp" else f"llmbuilder-vllm-{short}"


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


def _llamacpp_mount_and_model_path(instance: HostModelInstance) -> _LlamaCppMount:
    raw = (instance.model_ref or "").strip()
    cfg = instance.config or {}
    cfg_gguf = (cfg.get("llamacpp_gguf") or "").strip()
    local_raw = Path(raw).expanduser()
    model_path = local_raw.resolve()
    if model_path.is_file():
        if model_path.suffix.lower() != ".gguf":
            raise RuntimeError("llama.cpp engine requires model_ref to be a .gguf file or a directory containing GGUF weights")
        if _is_split_gguf_filename(model_path.name):
            host_dir = model_path.parent.resolve()
            mount_name = _container_mount_suffix(str(host_dir))
            container_base = f"/models/{mount_name}"
            return _LlamaCppMount(
                volume_args=["-v", f"{host_dir}:{container_base}:ro"],
                model_container_path=f"{container_base}/{model_path.name}",
            )
        container_file = f"/models/{model_path.name}"
        return _LlamaCppMount(
            volume_args=["-v", f"{model_path}:{container_file}:ro"],
            model_container_path=container_file,
        )
    if _running_in_container() and not model_path.exists():
        if raw.lower().endswith(".gguf"):
            raw_name = Path(raw).name
            if _is_split_gguf_filename(raw_name):
                parent_norm = os.path.normpath(str(Path(raw).expanduser().parent))
                mount_name = _container_mount_suffix(parent_norm)
                container_base = f"/models/{mount_name}"
                return _LlamaCppMount(
                    volume_args=["-v", f"{parent_norm}:{container_base}:ro"],
                    model_container_path=f"{container_base}/{raw_name}",
                )
            container_file = f"/models/{raw_name}" if raw_name else "/models/model.gguf"
            return _LlamaCppMount(
                volume_args=["-v", f"{raw}:{container_file}:ro"],
                model_container_path=container_file,
            )
        # Same as vLLM: model_ref is the model subfolder on the Docker host; list files via docker if needed.
        parent_norm = os.path.normpath(str(Path(raw).expanduser()))
        names = _docker_list_host_dir_basenames(parent_norm)
        chosen_name = _pick_llamacpp_entry_gguf_basename(names, cfg_gguf)
        mount_name = _container_mount_suffix(raw)
        container_base = f"/models/{mount_name}"
        return _LlamaCppMount(
            volume_args=["-v", f"{parent_norm}:{container_base}:ro"],
            model_container_path=f"{container_base}/{chosen_name}",
        )
    if not model_path.is_dir():
        raise RuntimeError(f"Local model path does not exist: {model_path}")

    names = sorted(p.name for p in model_path.glob("*.gguf"))
    chosen_name = _pick_llamacpp_entry_gguf_basename(names, cfg_gguf)

    mount_name = _container_mount_suffix(instance.model_ref)
    container_base = f"/models/{mount_name}"
    return _LlamaCppMount(
        volume_args=["-v", f"{str(model_path.resolve())}:{container_base}:ro"],
        model_container_path=f"{container_base}/{chosen_name}",
    )


def _build_vllm_run_cmd(instance: HostModelInstance) -> list[str]:
    docker = _docker_bin()
    container_name = _container_name(instance)
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


def _build_llamacpp_run_cmd(instance: HostModelInstance) -> list[str]:
    docker = _docker_bin()
    container_name = _container_name(instance)
    mount = _llamacpp_mount_and_model_path(instance)
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
    cmd.extend(mount.volume_args)
    cmd.append(_llamacpp_image())
    cmd.extend(
        [
            "-m",
            mount.model_container_path,
            "--host",
            "0.0.0.0",
            "--port",
            "8000",
            "--alias",
            instance.served_model_name,
        ]
    )
    cfg = instance.config or {}
    ctx = cfg.get("llamacpp_ctx_size")
    if ctx is not None:
        cmd.extend(["-c", str(int(ctx))])
    ngl = cfg.get("llamacpp_n_gpu_layers")
    if ngl is not None:
        cmd.extend(["--n-gpu-layers", str(int(ngl))])
    if instance.api_key:
        cmd.extend(["--api-key", instance.api_key])
    return cmd


def _build_run_cmd(instance: HostModelInstance) -> list[str]:
    return _build_llamacpp_run_cmd(instance) if _engine(instance) == "llama_cpp" else _build_vllm_run_cmd(instance)


def start_instance(instance: HostModelInstance) -> tuple[str, str]:
    remove_container(instance)
    cmd = _build_run_cmd(instance)
    container_id = _run(cmd)
    base_url = _client_facing_base_url(instance)
    return container_id, base_url


def stop_instance(instance: HostModelInstance) -> None:
    docker = _docker_bin()
    name = _container_name(instance)
    _run([docker, "stop", name])


def remove_container(instance: HostModelInstance) -> None:
    exe = _resolved_docker_executable()
    if not exe:
        return
    name = _container_name(instance)
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
    name = _container_name(instance)
    res = subprocess.run(
        [docker, "logs", "--tail", str(tail), name],
        capture_output=True,
        text=True,
    )
    if res.returncode != 0:
        err = (res.stderr or res.stdout or "").strip()
        if "no such container" in err.lower():
            return (
                f"No Docker container {name!r} (the inference container may not have started, exited and was removed, or start never succeeded). "
                f"Check the instance health_message, try Start, or on the host run: docker ps -a --filter name={name}\n"
                f"Docker: {err}"
            )
        raise RuntimeError(err or "docker logs failed")
    return (res.stdout or "")[-10000:]


def _inference_health_url(instance: HostModelInstance) -> str:
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
    url = _inference_health_url(instance)
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
    """Poll OpenAI server /health until success or HOST_MODELS_HEALTH_TIMEOUT_SECONDS elapses."""
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


def inference_internal_http_origin(instance: HostModelInstance) -> str:
    """scheme://host:port to reach this instance's OpenAI server from the API process (Docker publish port).

    Uses host.docker.internal so traffic hits the host's published -p bindings. Do not reuse
    HOST_MODELS_HEALTH_PROBE_BASE_URL here: bridge IPs like 172.17.0.1 often fail / refuse while
    host.docker.internal works for the same port."""
    if os.path.exists("/.dockerenv"):
        return f"http://host.docker.internal:{instance.port}"
    return f"http://127.0.0.1:{instance.port}"


def get_instance_endpoint(instance: HostModelInstance) -> str:
    pub = client_facing_base_url(instance).rstrip("/")
    return f"{pub}/v1/chat/completions"


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

    # API often runs in a container without the host model tree mounted; Docker still bind-mounts
    # from the Docker *host* at start time. Only assert existence when we see the host FS.
    if _running_in_container():
        return
    p = Path(model_path)
    if not p.exists():
        raise RuntimeError(f"Local model path does not exist: {p}")
    if not os.access(p, os.R_OK):
        raise RuntimeError(f"Local model path is not readable: {p}")
    if _engine(instance) == "llama_cpp":
        _llamacpp_mount_and_model_path(instance)


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

    llama_img = _llamacpp_image()
    checks["llamacpp_image"] = {
        "ok": True,
        "message": f"llama.cpp container image configured ({llama_img}); pull on the Docker host before using Host Models → llama.cpp",
        "value": llama_img,
    }

    all_ok = all(bool(c.get("ok")) for c in checks.values())
    any_ok = any(bool(c.get("ok")) for c in checks.values())
    level = "green" if all_ok else ("yellow" if any_ok else "red")
    return {"level": level, "checks": checks}
