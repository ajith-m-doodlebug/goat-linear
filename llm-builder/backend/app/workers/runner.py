"""RQ worker runner. Runs ingestion and other background tasks."""
import os
import sys

# Ensure app is on path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from redis import Redis
from rq import Worker

from app.core.config import get_settings

def main():
    settings = get_settings()
    redis_conn = Redis.from_url(settings.redis_url)
    worker = Worker(["default"], connection=redis_conn)
    worker.work()

if __name__ == "__main__":
    main()
