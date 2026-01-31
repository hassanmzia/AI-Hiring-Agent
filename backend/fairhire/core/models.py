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


# ─── Candidate ─────────────────────────────────────────────────
class Candidate(TimeStampedModel):
    class Stage(models.TextChoices):
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
        SHORTLISTED = "shortlisted", "Shortlisted"
        INTERVIEW = "interview", "Interview"
        OFFER = "offer", "Offer"
        HIRED = "hired", "Hired"
        REJECTED = "rejected", "Rejected"
        WITHDRAWN = "withdrawn", "Withdrawn"

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


# ─── Interview ────────────────────────────────────────────────
class Interview(TimeStampedModel):
    class InterviewType(models.TextChoices):
        PHONE = "phone", "Phone Screen"
        TECHNICAL = "technical", "Technical"
        BEHAVIORAL = "behavioral", "Behavioral"
        PANEL = "panel", "Panel"
        FINAL = "final", "Final Round"

    class Status(models.TextChoices):
        SCHEDULED = "scheduled", "Scheduled"
        COMPLETED = "completed", "Completed"
        CANCELLED = "cancelled", "Cancelled"
        NO_SHOW = "no_show", "No Show"

    candidate = models.ForeignKey(Candidate, on_delete=models.CASCADE, related_name="interviews")
    interview_type = models.CharField(max_length=20, choices=InterviewType.choices)
    interviewer = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name="interviews_conducted")
    scheduled_at = models.DateTimeField()
    duration_minutes = models.PositiveIntegerField(default=60)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.SCHEDULED)
    notes = models.TextField(blank=True)
    rating = models.PositiveSmallIntegerField(null=True, blank=True)
    ai_suggested_questions = models.JSONField(default=list, blank=True)

    class Meta:
        ordering = ["scheduled_at"]


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
        DECISION_MADE = "decision_made", "Decision Made"

    event_type = models.CharField(max_length=30, choices=EventType.choices)
    candidate = models.ForeignKey(Candidate, on_delete=models.CASCADE, null=True, blank=True, related_name="activity_logs")
    job_position = models.ForeignKey(JobPosition, on_delete=models.CASCADE, null=True, blank=True)
    user = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    message = models.TextField()
    metadata = models.JSONField(default=dict, blank=True)

    class Meta:
        ordering = ["-created_at"]
