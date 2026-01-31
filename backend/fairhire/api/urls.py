from django.urls import path, include
from rest_framework.routers import DefaultRouter

from . import views

router = DefaultRouter()
router.register(r"departments", views.DepartmentViewSet)
router.register(r"jobs", views.JobPositionViewSet)
router.register(r"candidates", views.CandidateViewSet)
router.register(r"executions", views.AgentExecutionViewSet)
router.register(r"interviews", views.InterviewViewSet)
router.register(r"templates", views.EvaluationTemplateViewSet)
router.register(r"activity", views.ActivityLogViewSet)

urlpatterns = [
    path("", include(router.urls)),
    path("dashboard/", views.dashboard_stats, name="dashboard-stats"),
    path("bulk-evaluate/", views.bulk_evaluate, name="bulk-evaluate"),
]
