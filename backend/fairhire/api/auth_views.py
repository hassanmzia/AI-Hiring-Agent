import io
import base64
import secrets
import logging

import pyotp
import qrcode
from django.contrib.auth import authenticate, login, logout, update_session_auth_hash
from django.contrib.auth.models import User
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError
from django.middleware.csrf import get_token
from rest_framework import status, permissions
from rest_framework.decorators import api_view, permission_classes, parser_classes, authentication_classes
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from rest_framework.response import Response

from fairhire.core.models import UserProfile, Candidate

logger = logging.getLogger("fairhire.api")


# ─── CSRF Token ──────────────────────────────────────────────
@api_view(["GET"])
@authentication_classes([])
@permission_classes([permissions.AllowAny])
def csrf_token_view(request):
    """Return a CSRF token for the frontend to use."""
    token = get_token(request)
    return Response({"csrfToken": token})


# ─── Login ───────────────────────────────────────────────────
@api_view(["POST"])
@authentication_classes([])
@permission_classes([permissions.AllowAny])
def login_view(request):
    username = request.data.get("username", "").strip()
    password = request.data.get("password", "")

    if not username or not password:
        return Response({"error": "Username and password are required"}, status=400)

    user = authenticate(request, username=username, password=password)
    if user is None:
        # Also try email as username
        try:
            user_by_email = User.objects.get(email__iexact=username)
            user = authenticate(request, username=user_by_email.username, password=password)
        except User.DoesNotExist:
            pass

    if user is None:
        return Response({"error": "Invalid credentials"}, status=401)

    if not user.is_active:
        return Response({"error": "Account is disabled"}, status=403)

    # Check if MFA is enabled
    profile = _get_or_create_profile(user)
    if profile.mfa_enabled:
        mfa_code = request.data.get("mfa_code", "").strip()
        if not mfa_code:
            return Response({"mfa_required": True, "message": "MFA code required"}, status=200)
        totp = pyotp.TOTP(profile.mfa_secret)
        if not totp.verify(mfa_code, valid_window=1):
            # Check backup codes
            if mfa_code in profile.mfa_backup_codes:
                profile.mfa_backup_codes.remove(mfa_code)
                profile.save(update_fields=["mfa_backup_codes"])
            else:
                return Response({"error": "Invalid MFA code"}, status=401)

    login(request, user)
    return Response(_user_response(user, profile))


# ─── Logout ──────────────────────────────────────────────────
@api_view(["POST"])
@permission_classes([permissions.IsAuthenticated])
def logout_view(request):
    logout(request)
    return Response({"message": "Logged out successfully"})


# ─── Register ────────────────────────────────────────────────
@api_view(["POST"])
@authentication_classes([])
@permission_classes([permissions.AllowAny])
def register_view(request):
    username = request.data.get("username", "").strip()
    email = request.data.get("email", "").strip()
    password = request.data.get("password", "")
    password_confirm = request.data.get("password_confirm", "")
    first_name = request.data.get("first_name", "").strip()
    last_name = request.data.get("last_name", "").strip()
    role = request.data.get("role", UserProfile.Role.CANDIDATE)

    if not username or not email or not password:
        return Response({"error": "Username, email, and password are required"}, status=400)

    if password != password_confirm:
        return Response({"error": "Passwords do not match"}, status=400)

    try:
        validate_password(password)
    except ValidationError as e:
        return Response({"error": list(e.messages)}, status=400)

    if User.objects.filter(username__iexact=username).exists():
        return Response({"error": "Username already taken"}, status=400)

    if User.objects.filter(email__iexact=email).exists():
        return Response({"error": "Email already registered"}, status=400)

    # Only allow candidate/viewer self-registration; others need admin
    allowed_self_register = [UserProfile.Role.CANDIDATE, UserProfile.Role.VIEWER]
    if role not in allowed_self_register:
        if not request.user.is_authenticated or not (
            request.user.is_superuser or getattr(request.user, "profile", None) and request.user.profile.is_admin
        ):
            role = UserProfile.Role.CANDIDATE

    user = User.objects.create_user(
        username=username, email=email, password=password,
        first_name=first_name, last_name=last_name,
    )
    profile = UserProfile.objects.create(user=user, role=role)

    login(request, user)
    return Response(_user_response(user, profile), status=201)


# ─── Current User (me) ──────────────────────────────────────
@api_view(["GET"])
@permission_classes([permissions.IsAuthenticated])
def me_view(request):
    profile = _get_or_create_profile(request.user)
    return Response(_user_response(request.user, profile))


# ─── Update Profile ─────────────────────────────────────────
@api_view(["PATCH"])
@permission_classes([permissions.IsAuthenticated])
def update_profile_view(request):
    user = request.user
    profile = _get_or_create_profile(user)

    # Update User fields
    for field in ["first_name", "last_name", "email"]:
        if field in request.data:
            setattr(user, field, request.data[field])

    if "email" in request.data:
        new_email = request.data["email"].strip()
        if User.objects.filter(email__iexact=new_email).exclude(pk=user.pk).exists():
            return Response({"error": "Email already in use"}, status=400)
        user.email = new_email

    user.save()

    # Update Profile fields
    for field in ["phone", "title", "department", "bio"]:
        if field in request.data:
            setattr(profile, field, request.data[field])
    profile.save()

    return Response(_user_response(user, profile))


# ─── Upload Profile Picture ─────────────────────────────────
@api_view(["POST"])
@permission_classes([permissions.IsAuthenticated])
@parser_classes([MultiPartParser, FormParser])
def upload_profile_picture_view(request):
    profile = _get_or_create_profile(request.user)
    file = request.FILES.get("profile_picture")
    if not file:
        return Response({"error": "No file uploaded"}, status=400)

    # Validate file type
    allowed_types = ["image/jpeg", "image/png", "image/gif", "image/webp"]
    if file.content_type not in allowed_types:
        return Response({"error": f"Invalid file type. Allowed: {', '.join(allowed_types)}"}, status=400)

    # Max 5MB
    if file.size > 5 * 1024 * 1024:
        return Response({"error": "File too large. Maximum 5MB."}, status=400)

    # Delete old picture if exists
    if profile.profile_picture:
        profile.profile_picture.delete(save=False)

    profile.profile_picture = file
    profile.save(update_fields=["profile_picture"])

    return Response({
        "message": "Profile picture updated",
        "profile_picture_url": request.build_absolute_uri(profile.profile_picture.url) if profile.profile_picture else None,
    })


# ─── Change Password ────────────────────────────────────────
@api_view(["POST"])
@permission_classes([permissions.IsAuthenticated])
def change_password_view(request):
    current_password = request.data.get("current_password", "")
    new_password = request.data.get("new_password", "")
    new_password_confirm = request.data.get("new_password_confirm", "")

    if not current_password or not new_password:
        return Response({"error": "Current and new password are required"}, status=400)

    if not request.user.check_password(current_password):
        return Response({"error": "Current password is incorrect"}, status=400)

    if new_password != new_password_confirm:
        return Response({"error": "New passwords do not match"}, status=400)

    try:
        validate_password(new_password, request.user)
    except ValidationError as e:
        return Response({"error": list(e.messages)}, status=400)

    request.user.set_password(new_password)
    request.user.save()
    update_session_auth_hash(request, request.user)

    return Response({"message": "Password changed successfully"})


# ─── MFA Setup ───────────────────────────────────────────────
@api_view(["POST"])
@permission_classes([permissions.IsAuthenticated])
def mfa_setup_view(request):
    """Generate a new TOTP secret and QR code for MFA setup."""
    profile = _get_or_create_profile(request.user)

    if profile.mfa_enabled:
        return Response({"error": "MFA is already enabled. Disable it first."}, status=400)

    # Generate new secret
    secret = pyotp.random_base32()
    profile.mfa_secret = secret
    profile.save(update_fields=["mfa_secret"])

    # Generate provisioning URI
    totp = pyotp.TOTP(secret)
    provisioning_uri = totp.provisioning_uri(
        name=request.user.email or request.user.username,
        issuer_name="FAIRHire",
    )

    # Generate QR code as base64
    qr = qrcode.QRCode(version=1, box_size=10, border=5)
    qr.add_data(provisioning_uri)
    qr.make(fit=True)
    img = qr.make_image(fill_color="black", back_color="white")
    buffer = io.BytesIO()
    img.save(buffer, format="PNG")
    qr_base64 = base64.b64encode(buffer.getvalue()).decode()

    return Response({
        "secret": secret,
        "provisioning_uri": provisioning_uri,
        "qr_code": f"data:image/png;base64,{qr_base64}",
    })


# ─── MFA Verify (enable) ────────────────────────────────────
@api_view(["POST"])
@permission_classes([permissions.IsAuthenticated])
def mfa_verify_view(request):
    """Verify TOTP code and enable MFA."""
    profile = _get_or_create_profile(request.user)
    code = request.data.get("code", "").strip()

    if not profile.mfa_secret:
        return Response({"error": "Run MFA setup first"}, status=400)

    totp = pyotp.TOTP(profile.mfa_secret)
    if not totp.verify(code, valid_window=1):
        return Response({"error": "Invalid code. Please try again."}, status=400)

    # Generate backup codes
    backup_codes = [secrets.token_hex(4) for _ in range(8)]
    profile.mfa_enabled = True
    profile.mfa_backup_codes = backup_codes
    profile.save(update_fields=["mfa_enabled", "mfa_backup_codes"])

    return Response({
        "message": "MFA enabled successfully",
        "backup_codes": backup_codes,
    })


# ─── MFA Disable ─────────────────────────────────────────────
@api_view(["POST"])
@permission_classes([permissions.IsAuthenticated])
def mfa_disable_view(request):
    """Disable MFA (requires current password)."""
    profile = _get_or_create_profile(request.user)
    password = request.data.get("password", "")

    if not request.user.check_password(password):
        return Response({"error": "Incorrect password"}, status=400)

    profile.mfa_enabled = False
    profile.mfa_secret = ""
    profile.mfa_backup_codes = []
    profile.save(update_fields=["mfa_enabled", "mfa_secret", "mfa_backup_codes"])

    return Response({"message": "MFA disabled"})


# ─── Candidate Self-Service ─────────────────────────────────
@api_view(["GET"])
@permission_classes([permissions.IsAuthenticated])
def candidate_profile_view(request):
    """Get linked candidate profile for candidate users."""
    profile = _get_or_create_profile(request.user)
    if not profile.linked_candidate:
        return Response({"error": "No linked candidate record"}, status=404)

    from .serializers import CandidateDetailSerializer
    return Response(CandidateDetailSerializer(profile.linked_candidate).data)


@api_view(["PATCH"])
@permission_classes([permissions.IsAuthenticated])
def candidate_update_view(request):
    """Allow candidates to update their own info."""
    profile = _get_or_create_profile(request.user)
    if not profile.linked_candidate:
        return Response({"error": "No linked candidate record"}, status=404)

    candidate = profile.linked_candidate
    allowed_fields = ["first_name", "last_name", "email", "phone"]
    for field in allowed_fields:
        if field in request.data:
            setattr(candidate, field, request.data[field])
    candidate.save()

    from .serializers import CandidateDetailSerializer
    return Response(CandidateDetailSerializer(candidate).data)


@api_view(["POST"])
@permission_classes([permissions.IsAuthenticated])
@parser_classes([MultiPartParser, FormParser])
def candidate_upload_resume_view(request):
    """Allow candidates to upload or replace their resume."""
    profile = _get_or_create_profile(request.user)
    if not profile.linked_candidate:
        return Response({"error": "No linked candidate record"}, status=404)

    candidate = profile.linked_candidate
    file = request.FILES.get("resume_file")
    resume_text = request.data.get("resume_text", "").strip()

    if not file and not resume_text:
        return Response({"error": "Upload a file or provide resume text"}, status=400)

    if file:
        # Extract text from file
        from .serializers import CandidateCreateSerializer
        extractor = CandidateCreateSerializer()
        file.seek(0)
        extracted = extractor._extract_text(file)
        file.seek(0)

        if not extracted.strip():
            return Response({"error": "Could not extract text from file"}, status=400)

        if candidate.resume_file:
            candidate.resume_file.delete(save=False)
        candidate.resume_file = file
        candidate.resume_text = extracted.strip()
    elif resume_text:
        candidate.resume_text = resume_text

    candidate.save()

    from .serializers import CandidateDetailSerializer
    return Response({
        "message": "Resume updated successfully",
        "candidate": CandidateDetailSerializer(candidate).data,
    })


# ─── Admin: Manage User Roles ───────────────────────────────
@api_view(["GET"])
@permission_classes([permissions.IsAuthenticated])
def users_with_roles_view(request):
    """List all users with their roles (admin/HR only)."""
    profile = _get_or_create_profile(request.user)
    if not profile.is_hr and not request.user.is_superuser:
        return Response({"error": "Permission denied"}, status=403)

    users = User.objects.all().order_by("first_name")
    result = []
    for u in users:
        p = _get_or_create_profile(u)
        result.append({
            "id": u.id,
            "username": u.username,
            "email": u.email,
            "first_name": u.first_name,
            "last_name": u.last_name,
            "full_name": u.get_full_name() or u.username,
            "role": p.role,
            "role_display": p.get_role_display(),
            "is_active": u.is_active,
            "mfa_enabled": p.mfa_enabled,
            "profile_picture_url": request.build_absolute_uri(p.profile_picture.url) if p.profile_picture else None,
            "date_joined": u.date_joined.isoformat(),
        })
    return Response(result)


@api_view(["PATCH"])
@permission_classes([permissions.IsAuthenticated])
def update_user_role_view(request, user_id):
    """Update a user's role (admin only)."""
    if not request.user.is_superuser:
        admin_profile = _get_or_create_profile(request.user)
        if not admin_profile.is_admin:
            return Response({"error": "Permission denied"}, status=403)

    try:
        target_user = User.objects.get(id=user_id)
    except User.DoesNotExist:
        return Response({"error": "User not found"}, status=404)

    profile = _get_or_create_profile(target_user)
    new_role = request.data.get("role")
    if new_role and new_role in dict(UserProfile.Role.choices):
        profile.role = new_role
        profile.save(update_fields=["role"])

    is_active = request.data.get("is_active")
    if is_active is not None:
        target_user.is_active = is_active
        target_user.save(update_fields=["is_active"])

    return Response({
        "id": target_user.id,
        "username": target_user.username,
        "role": profile.role,
        "role_display": profile.get_role_display(),
        "is_active": target_user.is_active,
    })


# ─── Helpers ─────────────────────────────────────────────────
def _get_or_create_profile(user: User) -> UserProfile:
    try:
        return user.profile
    except UserProfile.DoesNotExist:
        role = UserProfile.Role.ADMIN if user.is_superuser else UserProfile.Role.VIEWER
        return UserProfile.objects.create(user=user, role=role)


def _user_response(user: User, profile: UserProfile) -> dict:
    return {
        "id": user.id,
        "username": user.username,
        "email": user.email,
        "first_name": user.first_name,
        "last_name": user.last_name,
        "full_name": user.get_full_name() or user.username,
        "role": profile.role,
        "role_display": profile.get_role_display(),
        "is_superuser": user.is_superuser,
        "is_active": user.is_active,
        "mfa_enabled": profile.mfa_enabled,
        "profile_picture_url": profile.profile_picture.url if profile.profile_picture else None,
        "phone": profile.phone,
        "title": profile.title,
        "department": profile.department,
        "bio": profile.bio,
        "linked_candidate_id": str(profile.linked_candidate_id) if profile.linked_candidate_id else None,
        "date_joined": user.date_joined.isoformat(),
    }
