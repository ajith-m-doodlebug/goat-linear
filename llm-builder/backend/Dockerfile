FROM python:3.11-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    libpq-dev \
    curl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Static Docker CLI only (talks to host engine via mounted /var/run/docker.sock). The host's
# /usr/bin/docker is not visible inside this image — do not rely on HOST_MODELS_DOCKER_CMD
# pointing at a path that only exists on the host.
ARG DOCKER_CLI_VERSION=27.4.1
RUN ARCH=$(dpkg --print-architecture) \
    && case "$ARCH" in \
        amd64) DOCKER_DL_ARCH=x86_64 ;; \
        arm64) DOCKER_DL_ARCH=aarch64 ;; \
        *) echo "unsupported arch for bundled docker CLI: $ARCH (install docker.io in Dockerfile)"; exit 1 ;; \
    esac \
    && curl -fsSL "https://download.docker.com/linux/static/stable/${DOCKER_DL_ARCH}/docker-${DOCKER_CLI_VERSION}.tgz" \
    | tar -xz -C /tmp \
    && install -m 0755 /tmp/docker/docker /usr/bin/docker \
    && rm -rf /tmp/docker \
    && /usr/bin/docker --version

COPY requirements.txt .
ENV PIP_DEFAULT_TIMEOUT=600
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir --retries 10 torch --index-url https://download.pytorch.org/whl/cpu
RUN pip install --no-cache-dir --retries 10 -r requirements.txt

COPY . .
ENV PYTHONPATH=/app
ENV PYTHONUNBUFFERED=1

EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
