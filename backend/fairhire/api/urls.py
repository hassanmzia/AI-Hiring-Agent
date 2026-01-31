from django.urls import path, include
from rest_framework.routers import DefaultRouter

from . import views
from . import auth_views

router = DefaultRouter()
router.register(r"departments", views.DepartmentViewSet)
router.register(r"jobs", views.JobPositionViewSet)
router.register(r"candidates", views.CandidateViewSet)
router.register(r"executions", views.AgentExecutionViewSet)
router.register(r"interviews", views.InterviewViewSet)
router.register(r"interview-rounds", views.InterviewRoundViewSet)
router.register(r"interview-feedback", views.InterviewFeedbackViewSet)
router.register(r"offers", views.OfferViewSet)
router.register(r"hiring-team", views.HiringTeamMemberViewSet)
router.register(r"templates", views.EvaluationTemplateViewSet)
router.register(r"activity", views.ActivityLogViewSet)

urlpatterns = [
    path("", include(router.urls)),
    path("dashboard/", views.dashboard_stats, name="dashboard-stats"),
    path("bulk-evaluate/", views.bulk_evaluate, name="bulk-evaluate"),
    path("users/", views.users_list, name="users-list"),

    # ─── Authentication ──────────────────────────────────────
    path("auth/csrf/", auth_views.csrf_token_view, name="auth-csrf"),
    path("auth/login/", auth_views.login_view, name="auth-login"),
    path("auth/logout/", auth_views.logout_view, name="auth-logout"),
    path("auth/register/", auth_views.register_view, name="auth-register"),
    path("auth/me/", auth_views.me_view, name="auth-me"),
    path("auth/profile/", auth_views.update_profile_view, name="auth-profile"),
    path("auth/profile/picture/", auth_views.upload_profile_picture_view, name="auth-profile-picture"),
    path("auth/change-password/", auth_views.change_password_view, name="auth-change-password"),

    # ─── MFA ─────────────────────────────────────────────────
    path("auth/mfa/setup/", auth_views.mfa_setup_view, name="auth-mfa-setup"),
    path("auth/mfa/verify/", auth_views.mfa_verify_view, name="auth-mfa-verify"),
    path("auth/mfa/disable/", auth_views.mfa_disable_view, name="auth-mfa-disable"),

    # ─── Candidate Self-Service ──────────────────────────────
    path("auth/candidate/profile/", auth_views.candidate_profile_view, name="candidate-profile"),
    path("auth/candidate/update/", auth_views.candidate_update_view, name="candidate-update"),
    path("auth/candidate/resume/", auth_views.candidate_upload_resume_view, name="candidate-resume"),

    # ─── Admin User Management ───────────────────────────────
    path("auth/users/", auth_views.users_with_roles_view, name="auth-users"),
    path("auth/users/<int:user_id>/role/", auth_views.update_user_role_view, name="auth-user-role"),
]
