from rest_framework import permissions


class IsAdmin(permissions.BasePermission):
    """Only admins and superusers."""
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        if request.user.is_superuser:
            return True
        profile = getattr(request.user, "profile", None)
        return profile and profile.is_admin


class IsHROrAdmin(permissions.BasePermission):
    """HR officials and admins."""
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        if request.user.is_superuser:
            return True
        profile = getattr(request.user, "profile", None)
        return profile and profile.is_hr


class IsInterviewerOrAbove(permissions.BasePermission):
    """Interviewers, hiring managers, HR, and admins."""
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        if request.user.is_superuser:
            return True
        profile = getattr(request.user, "profile", None)
        return profile and profile.is_interviewer


class IsCandidateUser(permissions.BasePermission):
    """Only candidate-role users."""
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        profile = getattr(request.user, "profile", None)
        return profile and profile.is_candidate


class IsAuthenticatedReadOnly(permissions.BasePermission):
    """Authenticated users can read; write requires HR/Admin."""
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        if request.method in permissions.SAFE_METHODS:
            return True
        if request.user.is_superuser:
            return True
        profile = getattr(request.user, "profile", None)
        return profile and profile.is_hr


class ReadOnlyOrHR(permissions.BasePermission):
    """Authenticated can read. HR/Admin can write."""
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        if request.method in permissions.SAFE_METHODS:
            return True
        if request.user.is_superuser:
            return True
        profile = getattr(request.user, "profile", None)
        return profile and profile.is_hr
