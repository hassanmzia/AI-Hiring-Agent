"""Email notification service for FairHire hiring events."""

import logging
from django.conf import settings
from django.core.mail import send_mail
from django.template.loader import render_to_string

logger = logging.getLogger("fairhire.notifications")

FRONTEND_URL = getattr(settings, "FRONTEND_URL", "http://localhost:3047")


def _send(subject: str, body: str, recipients: list[str]):
    """Send an email, logging errors instead of crashing the caller."""
    if not recipients:
        return
    try:
        send_mail(
            subject=subject,
            message=body,
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=recipients,
            fail_silently=False,
        )
        logger.info("Email sent to %s: %s", recipients, subject)
    except Exception as exc:
        logger.error("Failed to send email to %s: %s", recipients, exc)


# ─── Offer Notifications ──────────────────────────────────────

def notify_offer_sent(offer):
    """Email the candidate when an offer is sent."""
    candidate = offer.candidate
    email = candidate.email
    if not email:
        logger.warning("No email for candidate %s, skipping notification", candidate.full_name)
        return
    subject = f"Offer Letter from {offer.job_position.department.name} — {offer.job_position.title}"
    body = (
        f"Dear {candidate.full_name},\n\n"
        f"We are pleased to extend an offer for the position of {offer.job_position.title}.\n\n"
        f"Salary: ${offer.salary:,.2f} {offer.salary_currency}/{offer.salary_period}\n"
    )
    if offer.signing_bonus:
        body += f"Signing Bonus: ${offer.signing_bonus:,.2f}\n"
    if offer.start_date:
        body += f"Start Date: {offer.start_date.strftime('%B %d, %Y')}\n"
    if offer.benefits_summary:
        body += f"Benefits: {offer.benefits_summary}\n"
    body += (
        f"\nPlease log in to review the full offer details:\n"
        f"{FRONTEND_URL}/offers\n\n"
        f"If you have any questions, please don't hesitate to reach out.\n\n"
        f"Best regards,\nThe Hiring Team"
    )
    if offer.offer_letter_text:
        body += f"\n\n--- OFFER LETTER ---\n\n{offer.offer_letter_text}"
    _send(subject, body, [email])


def notify_offer_accepted(offer):
    """Email the hiring team when a candidate accepts."""
    job = offer.job_position
    hiring_manager = job.created_by
    if not hiring_manager or not hiring_manager.email:
        return
    subject = f"Offer Accepted — {offer.candidate.full_name} for {job.title}"
    body = (
        f"{offer.candidate.full_name} has accepted the offer for {job.title}.\n\n"
        f"Salary: ${offer.salary:,.2f}\n"
        f"Start Date: {offer.start_date or 'TBD'}\n\n"
        f"Next step: Finalize the hire in FairHire.\n"
        f"{FRONTEND_URL}/offers\n"
    )
    _send(subject, body, [hiring_manager.email])


def notify_offer_declined(offer):
    """Email the hiring team when a candidate declines."""
    job = offer.job_position
    hiring_manager = job.created_by
    if not hiring_manager or not hiring_manager.email:
        return
    subject = f"Offer Declined — {offer.candidate.full_name} for {job.title}"
    body = (
        f"{offer.candidate.full_name} has declined the offer for {job.title}.\n\n"
        f"Reason: {offer.decline_reason or 'Not provided'}\n\n"
        f"You may want to extend an offer to another candidate.\n"
        f"{FRONTEND_URL}/candidates\n"
    )
    _send(subject, body, [hiring_manager.email])


# ─── Interview Notifications ──────────────────────────────────

def notify_interview_scheduled(interview):
    """Email the candidate and panel when an interview is scheduled."""
    candidate = interview.candidate
    recipients = []
    if candidate.email:
        recipients.append(candidate.email)
    # Also notify panel members
    for pm in interview.panel_members.select_related("interviewer").all():
        if pm.interviewer.email:
            recipients.append(pm.interviewer.email)
    if not recipients:
        return
    round_name = interview.interview_round.name if interview.interview_round else interview.get_interview_type_display()
    scheduled = interview.scheduled_at.strftime("%B %d, %Y at %I:%M %p") if interview.scheduled_at else "TBD"
    subject = f"Interview Scheduled: {round_name} — {candidate.full_name}"
    body = (
        f"An interview has been scheduled.\n\n"
        f"Candidate: {candidate.full_name}\n"
        f"Position: {candidate.job_position.title}\n"
        f"Type: {round_name}\n"
        f"Date/Time: {scheduled}\n"
        f"Location: {interview.location or 'TBD'}\n"
        f"Duration: {interview.duration_minutes} minutes\n\n"
        f"View details: {FRONTEND_URL}/interviews\n"
    )
    _send(subject, body, recipients)


def notify_feedback_submitted(feedback):
    """Email the hiring manager when interview feedback is submitted."""
    interview = feedback.interview
    job = interview.candidate.job_position
    hiring_manager = job.created_by
    if not hiring_manager or not hiring_manager.email:
        return
    interviewer_name = f"{feedback.interviewer.first_name} {feedback.interviewer.last_name}".strip()
    subject = f"Feedback Submitted: {interviewer_name} on {interview.candidate.full_name}"
    body = (
        f"{interviewer_name} submitted feedback for {interview.candidate.full_name}.\n\n"
        f"Recommendation: {feedback.get_recommendation_display() if feedback.recommendation else 'N/A'}\n"
        f"Overall Score: {feedback.overall_score or 'N/A'}/5\n\n"
        f"View full feedback: {FRONTEND_URL}/interviews\n"
    )
    _send(subject, body, [hiring_manager.email])


# ─── Approval Notifications ──────────────────────────────────

def notify_approval_requested(offer, approver):
    """Email an approver when their approval is needed."""
    if not approver.email:
        return
    subject = f"Approval Required: Offer for {offer.candidate.full_name} — {offer.job_position.title}"
    body = (
        f"An offer requires your approval.\n\n"
        f"Candidate: {offer.candidate.full_name}\n"
        f"Position: {offer.job_position.title}\n"
        f"Salary: ${offer.salary:,.2f} {offer.salary_currency}/{offer.salary_period}\n\n"
        f"Please review and approve: {FRONTEND_URL}/offers\n"
    )
    _send(subject, body, [approver.email])


# ─── Candidate Pipeline Notifications ─────────────────────────

def notify_candidate_shortlisted(candidate):
    """Email the hiring manager when a candidate is auto-shortlisted."""
    job = candidate.job_position
    hiring_manager = job.created_by
    if not hiring_manager or not hiring_manager.email:
        return
    subject = f"Candidate Shortlisted: {candidate.full_name} for {job.title}"
    body = (
        f"{candidate.full_name} has been automatically shortlisted for {job.title}.\n\n"
        f"AI Recommendation: {candidate.suggested_action or 'N/A'}\n"
        f"Overall Score: {candidate.overall_score or 'N/A'}\n\n"
        f"Interviews have been set up. View details:\n"
        f"{FRONTEND_URL}/candidates\n"
    )
    _send(subject, body, [hiring_manager.email])
