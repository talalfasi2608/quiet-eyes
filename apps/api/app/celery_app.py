from celery import Celery
from celery.schedules import crontab

from app.config import settings

celery = Celery(
    "quieteyes",
    broker=settings.REDIS_URL,
    backend=settings.REDIS_URL,
)

celery.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    beat_schedule={
        "ingest-all-businesses-hourly": {
            "task": "app.tasks.ingest_all_task",
            "schedule": crontab(minute=0),  # every hour
        },
    },
)

celery.autodiscover_tasks(["app"])
