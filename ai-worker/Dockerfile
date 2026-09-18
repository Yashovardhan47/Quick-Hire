FROM python:3.11-slim

ENV HF_HOME=/models/huggingface \
    XDG_CACHE_HOME=/models/cache

WORKDIR /worker
RUN apt-get update \
    && apt-get install -y --no-install-recommends ffmpeg \
    && rm -rf /var/lib/apt/lists/*
COPY ai-worker/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY ai-worker/app ./app
RUN useradd --create-home --uid 10002 modelworker \
    && mkdir -p /models \
    && chown -R modelworker:modelworker /worker /models
USER modelworker
HEALTHCHECK --interval=30s --timeout=5s --start-period=120s --retries=5 CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8100/health', timeout=3)"
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8100"]
