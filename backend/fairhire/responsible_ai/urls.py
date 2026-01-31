from django.urls import path
from . import views

urlpatterns = [
    path("fairness-dashboard/", views.fairness_dashboard, name="fairness-dashboard"),
    path("agent-performance/", views.agent_performance, name="agent-performance"),
]
