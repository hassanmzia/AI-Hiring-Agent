import os
from celery import Celery

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "fairhire.settings")

app = Celery("fairhire")
app.config_from_object("django.conf:settings", namespace="CELERY")
app.autodiscover_tasks()
