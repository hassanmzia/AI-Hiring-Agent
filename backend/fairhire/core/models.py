import uuid
from django.db import models
from django.contrib.auth.models import User


class TimeStampedModel(models.Model):
    """Abstract base with created/updated timestamps."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True


# ─── User Profile (extends Django User via OneToOne) ─────────
class UserProfile(models.Model):
    class Role(models.TextChoices):
        ADMIN = "admin", "Administrator"
        HR = "hr", "HR Official"
        INTERVIEWER = "interviewer", "Interviewer"
        HIRING_MANAGER = "hiring_manager", "Hiring Manager"
        CANDIDATE = "candidate", "Candidate"
        VIEWER = "viewer", "Viewer (Read-Only)"

    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="profile")
    role = models.CharField(max_length=20, choices=Role.choices, default=Role.VIEWER)
    profile_picture = models.ImageField(upload_to="profile_pics/%Y/%m/", null=True, blank=True)
    phone = models.CharField(max_length=50, blank=True)
    title = models.CharField(max_length=200, blank=True, help_text="Job title")
    department = models.CharField(max_length=200, blank=True)
    bio = models.TextField(blank=True)

    # MFA (TOTP)
    mfa_secret = models.CharField(max_length=64, blank=True, help_text="TOTP secret key")
    mfa_enabled = models.BooleanField(default=False)
    mfa_backup_codes = models.JSONField(default=list, blank=True, help_text="One-time backup codes")

    # Linked candidate record (for candidate role)
    linked_candidate = models.ForeignKey(
        "Candidate", on_delete=models.SET_NULL, null=True, blank=True,
        related_name="user_profile", help_text="Linked candidate record for candidate users",
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.user.get_full_name() or self.user.username} ({self.get_role_display()})"

    @property
    def is_admin(self):
        return self.role == self.Role.ADMIN or self.user.is_superuser

    @property
    def is_hr(self):
        return self.role in [self.Role.ADMIN, self.Role.HR]

    @property
    def is_interviewer(self):
        return self.role in [self.Role.ADMIN, self.Role.HR, self.Role.INTERVIEWER, self.Role.HIRING_MANAGER]

    @property
    def is_candidate(self):
        return self.role == self.Role.CANDIDATE


# ─── Job / Position ────────────────────────────────────────────
class Department(TimeStampedModel):
    name = models.CharField(max_length=200, unique=True)
    description = models.TextField(blank=True)

    def __str__(self):
        return self.name


class JobPosition(TimeStampedModel):
    class Status(models.TextChoices):
        DRAFT = "draft", "Draft"
        OPEN = "open", "Open"
        PAUSED = "paused", "Paused"
        CLOSED = "closed", "Closed"

    class ExperienceLevel(models.TextChoices):
        ENTRY = "entry", "Entry Level"
        MID = "mid", "Mid Level"
        SENIOR = "senior", "Senior"
        LEAD = "lead", "Lead"
        PRINCIPAL = "principal", "Principal"

    title = models.CharField(max_length=300)
    department = models.ForeignKey(Department, on_delete=models.CASCADE, related_name="positions")
    description = models.TextField()
    requirements = models.TextField(help_text="Required skills and qualifications")
    nice_to_have = models.TextField(blank=True, help_text="Preferred qualifications")
    experience_level = models.CharField(max_length=20, choices=ExperienceLevel.choices)
    min_experience_years = models.PositiveIntegerField(default=0)
    max_experience_years = models.PositiveIntegerField(default=30)
    location = models.CharField(max_length=200, blank=True)
    is_remote = models.BooleanField(default=False)
    salary_min = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    salary_max = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.DRAFT)
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name="created_positions")
    max_candidates = models.PositiveIntegerField(default=100)

    # AI-generated rubric weights (from notebook RUBRIC concept)
    rubric_weights = models.JSONField(default=dict, blank=True, help_text="Scoring rubric component weights")

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.title} ({self.department.name})"


# ─── Hiring Team / Interviewers ───────────────────────────────
class HiringTeamMember(TimeStampedModel):
    """Represents a person who can conduct interviews and provide feedback."""
    class Role(models.TextChoices):
        HIRING_MANAGER = "hiring_manager", "Hiring Manager"
        RECRUITER = "recruiter", "Recruiter"
        INTERVIEWER = "interviewer", "Interviewer"
        PANEL_MEMBER = "panel_member", "Panel Member"
        EXECUTIVE = "executive", "Executive"

    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="hiring_profile")
    role = models.CharField(max_length=30, choices=Role.choices, default=Role.INTERVIEWER)
    title = models.CharField(max_length=200, blank=True)
    department = models.ForeignKey(Department, on_delete=models.SET_NULL, null=True, blank=True, related_name="team_members")
    expertise_areas = models.JSONField(default=list, blank=True, help_text="Areas of expertise for interview matching")
    max_interviews_per_week = models.PositiveIntegerField(default=5)
    is_active = models.BooleanField(default=True)
    calendar_link = models.URLField(blank=True, help_text="External calendar link for scheduling")

    class Meta:
        ordering = ["user__first_name"]

    def __str__(self):
        return f"{self.user.get_full_name()} ({self.get_role_display()})"


# ─── Candidate ─────────────────────────────────────────────────
class Candidate(TimeStampedModel):
    class Stage(models.TextChoices):
        # AI Processing stages
        NEW = "new", "New"
        PARSING = "parsing", "Parsing Resume"
        PARSED = "parsed", "Resume Parsed"
        SCREENING = "screening", "AI Screening"
        SCREENED = "screened", "Screened"
        GUARDRAIL_CHECK = "guardrail_check", "Guardrail Check"
        SCORING = "scoring", "Scoring"
        SCORED = "scored", "Scored"
        SUMMARIZING = "summarizing", "Summarizing"
        SUMMARIZED = "summarized", "Summarized"
        BIAS_AUDIT = "bias_audit", "Bias Audit"
        REVIEWED = "reviewed", "AI Review Complete"
        # Human review stages
        SHORTLISTED = "shortlisted", "Shortlisted"
        # Interview stages
        INTERVIEW_SETUP = "interview_setup", "Interview Setup"
        PHONE_SCREEN = "phone_screen", "Phone Screening"
        TECHNICAL_INTERVIEW = "technical_interview", "Technical Interview"
        BEHAVIORAL_INTERVIEW = "behavioral_interview", "Behavioral Interview"
        PANEL_INTERVIEW = "panel_interview", "Panel Interview"
        FINAL_INTERVIEW = "final_interview", "Final Interview"
        INTERVIEW_COMPLETE = "interview_complete", "Interviews Complete"
        # Decision stages
        FINAL_EVALUATION = "final_evaluation", "Final Evaluation"
        APPROVED_FOR_OFFER = "approved_for_offer", "Approved for Offer"
        # Offer stages
        OFFER_DRAFTING = "offer_drafting", "Drafting Offer"
        OFFER_APPROVAL = "offer_approval", "Offer Approval"
        OFFER_EXTENDED = "offer_extended", "Offer Extended"
        OFFER_NEGOTIATION = "offer_negotiation", "Offer Negotiation"
        OFFER_ACCEPTED = "offer_accepted", "Offer Accepted"
        OFFER_DECLINED = "offer_declined", "Offer Declined"
        # Final stages
        HIRED = "hired", "Hired"
        REJECTED = "rejected", "Rejected"
        WITHDRAWN = "withdrawn", "Withdrawn"
        ON_HOLD = "on_hold", "On Hold"

    job_position = models.ForeignKey(JobPosition, on_delete=models.CASCADE, related_name="candidates")
    first_name = models.CharField(max_length=100, blank=True)
    last_name = models.CharField(max_length=100, blank=True)
    email = models.EmailField(blank=True)
    phone = models.CharField(max_length=50, blank=True)
    stage = models.CharField(max_length=30, choices=Stage.choices, default=Stage.NEW)

    # Resume
    resume_file = models.FileField(upload_to="resumes/%Y/%m/", null=True, blank=True)
    resume_text = models.TextField(blank=True, help_text="Raw extracted text from resume")
    resume_redacted = models.TextField(blank=True, help_text="PII-redacted resume text")

    # Parsed data (from resume parser agent)
    parsed_data = models.JSONField(default=dict, blank=True)
    skills = models.JSONField(default=list, blank=True)
    experience_years = models.FloatField(null=True, blank=True)
    education = models.JSONField(default=list, blank=True)
    age = models.PositiveIntegerField(null=True, blank=True)

    # AI evaluation results
    guardrail_results = models.JSONField(default=dict, blank=True)
    guardrail_passed = models.BooleanField(null=True)
    scoring_results = models.JSONField(default=dict, blank=True)
    overall_score = models.FloatField(null=True, blank=True)
    confidence = models.FloatField(null=True, blank=True)
    summary_results = models.JSONField(default=dict, blank=True)
    suggested_action = models.CharField(max_length=50, blank=True)

    # Bias audit results
    bias_audit_results = models.JSONField(default=dict, blank=True)
    bias_flags = models.JSONField(default=list, blank=True)

    # Human review
    reviewer = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name="reviewed_candidates")
    reviewer_notes = models.TextField(blank=True)
    reviewer_decision = models.CharField(max_length=50, blank=True)

    # Final evaluation (after interviews)
    final_score = models.FloatField(null=True, blank=True, help_text="Combined AI + interview score")
    final_recommendation = models.CharField(max_length=50, blank=True)
    final_notes = models.TextField(blank=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.first_name} {self.last_name} — {self.job_position.title}"

    @property
    def full_name(self):
        return f"{self.first_name} {self.last_name}".strip() or "Unknown"


# ─── Agent Execution Logs ─────────────────────────────────────
class AgentExecution(TimeStampedModel):
    class AgentType(models.TextChoices):
        PARSER = "parser", "Resume Parser"
        GUARDRAIL = "guardrail", "Guardrail Checker"
        SCORER = "scorer", "Scoring Agent"
        SUMMARIZER = "summarizer", "Summary Agent"
        BIAS_AUDITOR = "bias_auditor", "Bias Auditor"
        ORCHESTRATOR = "orchestrator", "Orchestrator"

    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        RUNNING = "running", "Running"
        COMPLETED = "completed", "Completed"
        FAILED = "failed", "Failed"

    candidate = models.ForeignKey(Candidate, on_delete=models.CASCADE, related_name="agent_executions")
    agent_type = models.CharField(max_length=30, choices=AgentType.choices)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING)
    input_data = models.JSONField(default=dict)
    output_data = models.JSONField(default=dict)
    error_message = models.TextField(blank=True)
    duration_seconds = models.FloatField(null=True, blank=True)
    llm_tokens_used = models.PositiveIntegerField(default=0)
    llm_model = models.CharField(max_length=100, blank=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.agent_type} for {self.candidate} — {self.status}"


# ─── Bias Audit Probes ────────────────────────────────────────
class BiasProbe(TimeStampedModel):
    class ProbeType(models.TextChoices):
        NAME_SWAP = "name_swap", "Name Swap"
        PROXY_FLIP = "proxy_flip", "Proxy Attribute Flip"
        ADVERSARIAL = "adversarial", "Adversarial Injection"

    candidate = models.ForeignKey(Candidate, on_delete=models.CASCADE, related_name="bias_probes")
    probe_type = models.CharField(max_length=30, choices=ProbeType.choices)
    scenario = models.CharField(max_length=200)
    original_score = models.FloatField()
    probe_score = models.FloatField()
    delta = models.FloatField()
    components = models.JSONField(default=dict)
    explanation = models.TextField(blank=True)
    flagged = models.BooleanField(default=False)

    class Meta:
        ordering = ["-created_at"]


# ─── Interview Round ──────────────────────────────────────────
class InterviewRound(TimeStampedModel):
    """Defines an interview round for a job position."""
    class RoundType(models.TextChoices):
        PHONE_SCREEN = "phone_screen", "Phone Screen"
        TECHNICAL = "technical", "Technical"
        BEHAVIORAL = "behavioral", "Behavioral"
        PANEL = "panel", "Panel"
        FINAL = "final", "Final Round"
        CUSTOM = "custom", "Custom"

    job_position = models.ForeignKey(JobPosition, on_delete=models.CASCADE, related_name="interview_rounds")
    round_type = models.CharField(max_length=20, choices=RoundType.choices)
    name = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    order = models.PositiveIntegerField(default=1, help_text="Order in the interview sequence")
    duration_minutes = models.PositiveIntegerField(default=60)
    is_required = models.BooleanField(default=True)
    pass_threshold = models.FloatField(default=3.0, help_text="Minimum average rating to pass (1-5)")
    evaluation_criteria = models.JSONField(default=list, blank=True, help_text="Criteria for this round")

    class Meta:
        ordering = ["job_position", "order"]
        unique_together = ["job_position", "order"]

    def __str__(self):
        return f"{self.name} (Round {self.order}) — {self.job_position.title}"


# ─── Interview (updated) ─────────────────────────────────────
class Interview(TimeStampedModel):
    class InterviewType(models.TextChoices):
        PHONE = "phone", "Phone Screen"
        TECHNICAL = "technical", "Technical"
        BEHAVIORAL = "behavioral", "Behavioral"
        PANEL = "panel", "Panel"
        FINAL = "final", "Final Round"

    class Status(models.TextChoices):
        DRAFT = "draft", "Draft"
        SCHEDULED = "scheduled", "Scheduled"
        IN_PROGRESS = "in_progress", "In Progress"
        COMPLETED = "completed", "Completed"
        CANCELLED = "cancelled", "Cancelled"
        NO_SHOW = "no_show", "No Show"
        RESCHEDULED = "rescheduled", "Rescheduled"

    candidate = models.ForeignKey(Candidate, on_delete=models.CASCADE, related_name="interviews")
    interview_round = models.ForeignKey(InterviewRound, on_delete=models.SET_NULL, null=True, blank=True, related_name="interviews")
    interview_type = models.CharField(max_length=20, choices=InterviewType.choices)
    scheduled_at = models.DateTimeField(null=True, blank=True)
    duration_minutes = models.PositiveIntegerField(default=60)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.DRAFT)
    location = models.CharField(max_length=500, blank=True, help_text="Room, video link, phone number, etc.")
    notes = models.TextField(blank=True, help_text="Internal notes about the interview")
    overall_rating = models.FloatField(null=True, blank=True, help_text="Average from all feedback scores")
    overall_recommendation = models.CharField(max_length=50, blank=True)
    ai_suggested_questions = models.JSONField(default=list, blank=True)

    # Legacy field kept for compatibility
    interviewer = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name="interviews_conducted")
    rating = models.PositiveSmallIntegerField(null=True, blank=True)

    class Meta:
        ordering = ["scheduled_at"]

    def __str__(self):
        return f"{self.get_interview_type_display()} — {self.candidate.full_name}"

    def compute_overall_rating(self):
        feedbacks = self.feedbacks.filter(submitted=True)
        if feedbacks.exists():
            self.overall_rating = feedbacks.aggregate(avg=models.Avg("overall_score"))["avg"]
            # Derive recommendation from average
            if self.overall_rating >= 4.0:
                self.overall_recommendation = "strong_hire"
            elif self.overall_rating >= 3.0:
                self.overall_recommendation = "hire"
            elif self.overall_rating >= 2.0:
                self.overall_recommendation = "no_hire"
            else:
                self.overall_recommendation = "strong_no_hire"
            self.save(update_fields=["overall_rating", "overall_recommendation"])


# ─── Interview Panel ──────────────────────────────────────────
class InterviewPanel(TimeStampedModel):
    """Assigns interviewers to a specific interview."""
    class PanelRole(models.TextChoices):
        LEAD = "lead", "Lead Interviewer"
        MEMBER = "member", "Panel Member"
        OBSERVER = "observer", "Observer"
        SHADOW = "shadow", "Shadow (Learning)"

    interview = models.ForeignKey(Interview, on_delete=models.CASCADE, related_name="panel_members")
    interviewer = models.ForeignKey(User, on_delete=models.CASCADE, related_name="interview_panels")
    role = models.CharField(max_length=20, choices=PanelRole.choices, default=PanelRole.MEMBER)
    confirmed = models.BooleanField(default=False)
    declined = models.BooleanField(default=False)
    decline_reason = models.TextField(blank=True)

    class Meta:
        unique_together = ["interview", "interviewer"]
        ordering = ["role"]

    def __str__(self):
        return f"{self.interviewer.get_full_name()} ({self.get_role_display()}) — {self.interview}"


# ─── Interview Feedback / Scorecard ───────────────────────────
class InterviewFeedback(TimeStampedModel):
    """Individual interviewer's feedback for a specific interview."""
    class Recommendation(models.TextChoices):
        STRONG_HIRE = "strong_hire", "Strong Hire"
        HIRE = "hire", "Hire"
        NO_HIRE = "no_hire", "No Hire"
        STRONG_NO_HIRE = "strong_no_hire", "Strong No Hire"

    interview = models.ForeignKey(Interview, on_delete=models.CASCADE, related_name="feedbacks")
    interviewer = models.ForeignKey(User, on_delete=models.CASCADE, related_name="interview_feedbacks")
    submitted = models.BooleanField(default=False)
    submitted_at = models.DateTimeField(null=True, blank=True)

    # Scorecard sections (1-5 scale)
    technical_score = models.FloatField(null=True, blank=True, help_text="1-5 scale")
    communication_score = models.FloatField(null=True, blank=True, help_text="1-5 scale")
    problem_solving_score = models.FloatField(null=True, blank=True, help_text="1-5 scale")
    culture_fit_score = models.FloatField(null=True, blank=True, help_text="1-5 scale")
    leadership_score = models.FloatField(null=True, blank=True, help_text="1-5 scale")
    overall_score = models.FloatField(null=True, blank=True, help_text="1-5 overall rating")

    recommendation = models.CharField(max_length=20, choices=Recommendation.choices, blank=True)
    strengths = models.TextField(blank=True)
    weaknesses = models.TextField(blank=True)
    notes = models.TextField(blank=True)
    detailed_scores = models.JSONField(default=dict, blank=True, help_text="Additional criteria scores")

    class Meta:
        unique_together = ["interview", "interviewer"]
        ordering = ["-created_at"]

    def __str__(self):
        return f"Feedback by {self.interviewer.get_full_name()} — {self.interview}"


# ─── Offer ────────────────────────────────────────────────────
class Offer(TimeStampedModel):
    class Status(models.TextChoices):
        DRAFTING = "drafting", "Drafting"
        PENDING_APPROVAL = "pending_approval", "Pending Approval"
        APPROVED = "approved", "Approved"
        SENT = "sent", "Sent to Candidate"
        NEGOTIATING = "negotiating", "Negotiating"
        ACCEPTED = "accepted", "Accepted"
        DECLINED = "declined", "Declined"
        WITHDRAWN = "withdrawn", "Withdrawn"
        EXPIRED = "expired", "Expired"

    class EmploymentType(models.TextChoices):
        FULL_TIME = "full_time", "Full Time"
        PART_TIME = "part_time", "Part Time"
        CONTRACT = "contract", "Contract"
        INTERNSHIP = "internship", "Internship"

    candidate = models.ForeignKey(Candidate, on_delete=models.CASCADE, related_name="offers")
    job_position = models.ForeignKey(JobPosition, on_delete=models.CASCADE, related_name="offers")
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name="offers_created")
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.DRAFTING)

    # Compensation
    salary = models.DecimalField(max_digits=12, decimal_places=2)
    salary_currency = models.CharField(max_length=3, default="USD")
    salary_period = models.CharField(max_length=20, default="annual")
    signing_bonus = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    equity_details = models.TextField(blank=True, help_text="Stock options, RSUs, etc.")
    bonus_structure = models.TextField(blank=True)

    # Employment details
    employment_type = models.CharField(max_length=20, choices=EmploymentType.choices, default=EmploymentType.FULL_TIME)
    start_date = models.DateField(null=True, blank=True)
    location = models.CharField(max_length=200, blank=True)
    is_remote = models.BooleanField(default=False)
    reporting_to = models.CharField(max_length=200, blank=True)
    benefits_summary = models.TextField(blank=True)

    # Offer communication
    offer_letter_text = models.TextField(blank=True)
    sent_at = models.DateTimeField(null=True, blank=True)
    expires_at = models.DateTimeField(null=True, blank=True)
    responded_at = models.DateTimeField(null=True, blank=True)

    # Negotiation tracking
    negotiation_notes = models.TextField(blank=True)
    counter_offer_details = models.JSONField(default=dict, blank=True)
    revision_number = models.PositiveIntegerField(default=1)

    # Candidate response
    candidate_response = models.TextField(blank=True)
    decline_reason = models.TextField(blank=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"Offer for {self.candidate.full_name} — {self.job_position.title} ({self.get_status_display()})"


# ─── Offer Approval ───────────────────────────────────────────
class OfferApproval(TimeStampedModel):
    class Decision(models.TextChoices):
        PENDING = "pending", "Pending"
        APPROVED = "approved", "Approved"
        REJECTED = "rejected", "Rejected"
        CHANGES_REQUESTED = "changes_requested", "Changes Requested"

    offer = models.ForeignKey(Offer, on_delete=models.CASCADE, related_name="approvals")
    approver = models.ForeignKey(User, on_delete=models.CASCADE, related_name="offer_approvals")
    order = models.PositiveIntegerField(default=1, help_text="Approval chain order")
    decision = models.CharField(max_length=20, choices=Decision.choices, default=Decision.PENDING)
    comments = models.TextField(blank=True)
    decided_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["offer", "order"]
        unique_together = ["offer", "approver"]

    def __str__(self):
        return f"Approval by {self.approver.get_full_name()} — {self.offer}"


# ─── Evaluation Template ─────────────────────────────────────
class EvaluationTemplate(TimeStampedModel):
    """Reusable rubric template for positions."""
    name = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    rubric_weights = models.JSONField(
        default=dict,
        help_text="Component weights, e.g. {experience_ic: 0.25, education_rigor: 0.12, ...}"
    )
    policies = models.JSONField(default=list, help_text="Responsible AI policies for scoring")
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True)

    def __str__(self):
        return self.name


# ─── Notification / Activity Feed ─────────────────────────────
class ActivityLog(TimeStampedModel):
    class EventType(models.TextChoices):
        CANDIDATE_CREATED = "candidate_created", "Candidate Created"
        STAGE_CHANGED = "stage_changed", "Stage Changed"
        AGENT_COMPLETED = "agent_completed", "Agent Completed"
        BIAS_FLAG = "bias_flag", "Bias Flag Raised"
        INTERVIEW_SCHEDULED = "interview_scheduled", "Interview Scheduled"
        INTERVIEW_COMPLETED = "interview_completed", "Interview Completed"
        FEEDBACK_SUBMITTED = "feedback_submitted", "Feedback Submitted"
        OFFER_CREATED = "offer_created", "Offer Created"
        OFFER_SENT = "offer_sent", "Offer Sent"
        OFFER_ACCEPTED = "offer_accepted", "Offer Accepted"
        OFFER_DECLINED = "offer_declined", "Offer Declined"
        DECISION_MADE = "decision_made", "Decision Made"

    event_type = models.CharField(max_length=30, choices=EventType.choices)
    candidate = models.ForeignKey(Candidate, on_delete=models.CASCADE, null=True, blank=True, related_name="activity_logs")
    job_position = models.ForeignKey(JobPosition, on_delete=models.CASCADE, null=True, blank=True)
    user = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    message = models.TextField()
    metadata = models.JSONField(default=dict, blank=True)

    class Meta:
        ordering = ["-created_at"]
