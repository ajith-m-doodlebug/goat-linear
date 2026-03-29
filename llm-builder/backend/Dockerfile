FROM python:3.11-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    libpq-dev \
    curl \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
# PyPI torch on Linux arm64 pulls CUDA/cuDNN/triton (~1.3GB+); containers here are CPU-only.
# Install torch from PyTorch's CPU index first so `pip install -r` does not download NVIDIA wheels.
ENV PIP_DEFAULT_TIMEOUT=600
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir --retries 10 torch --index-url https://download.pytorch.org/whl/cpu
RUN pip install --no-cache-dir --retries 10 -r requirements.txt

COPY . .
ENV PYTHONPATH=/app
ENV PYTHONUNBUFFERED=1

EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
