import logging
from datetime import timedelta

from django.contrib.auth.models import User
from django.db.models import Avg, Count, Q
from django.utils import timezone
from rest_framework import viewsets, status, permissions
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser

from fairhire.core.models import (
    Department, JobPosition, Candidate, AgentExecution,
    BiasProbe, Interview, InterviewRound, InterviewPanel,
    InterviewFeedback, Offer, OfferApproval, HiringTeamMember,
    EvaluationTemplate, ActivityLog,
)
from fairhire.core.services import auto_setup_interviews as _auto_setup_interviews
from fairhire.agents.tasks import run_pipeline_task, run_single_agent_task, bulk_evaluate_candidates
from .serializers import (
    DepartmentSerializer, JobPositionListSerializer, JobPositionDetailSerializer,
    CandidateListSerializer, CandidateDetailSerializer, CandidateCreateSerializer,
    AgentExecutionSerializer, BiasProbeSerializer,
    InterviewSerializer, InterviewListSerializer, InterviewDetailSerializer,
    InterviewRoundSerializer, InterviewPanelSerializer, InterviewFeedbackSerializer,
    OfferListSerializer, OfferDetailSerializer, OfferCreateSerializer,
    OfferApprovalSerializer, HiringTeamMemberSerializer, UserMinimalSerializer,
    EvaluationTemplateSerializer, ActivityLogSerializer, BulkEvaluateSerializer,
)

logger = logging.getLogger("fairhire.api")


# ─── Department ───────────────────────────────────────────────
class DepartmentViewSet(viewsets.ModelViewSet):
    queryset = Department.objects.all()
    serializer_class = DepartmentSerializer
    search_fields = ["name"]


# ─── Job Position ─────────────────────────────────────────────
class JobPositionViewSet(viewsets.ModelViewSet):
    queryset = JobPosition.objects.select_related("department").all()
    filterset_fields = ["status", "experience_level", "department", "is_remote"]
    search_fields = ["title", "description", "requirements"]
    ordering_fields = ["created_at", "title"]

    def get_serializer_class(self):
        if self.action == "list":
            return JobPositionListSerializer
        return JobPositionDetailSerializer

    @action(detail=True, methods=["post"])
    def bulk_evaluate(self, request, pk=None):
        job = self.get_object()
        run_audit = request.data.get("run_bias_audit", True)
        result = bulk_evaluate_candidates.delay(str(job.id), run_bias_audit=run_audit)
        return Response({"task_id": str(result.id), "status": "queued"})

    @action(detail=True, methods=["get"])
    def pipeline_stats(self, request, pk=None):
        job = self.get_object()
        stages = (
            job.candidates.values("stage")
            .annotate(count=Count("id"))
            .order_by("stage")
        )
        avg_score = job.candidates.filter(overall_score__isnull=False).aggregate(
            avg=Avg("overall_score")
        )
        return Response({
            "stages": {s["stage"]: s["count"] for s in stages},
            "average_score": round(avg_score["avg"] or 0, 3),
            "total_candidates": job.candidates.count(),
        })

    @action(detail=True, methods=["post"])
    def setup_interview_rounds(self, request, pk=None):
        """Create default interview rounds for a job position."""
        job = self.get_object()
        if job.interview_rounds.exists():
            return Response({"error": "Interview rounds already exist for this position"}, status=400)
        defaults = [
            {"round_type": "phone_screen", "name": "Phone Screen", "order": 1, "duration_minutes": 30},
            {"round_type": "technical", "name": "Technical Interview", "order": 2, "duration_minutes": 60},
            {"round_type": "behavioral", "name": "Behavioral Interview", "order": 3, "duration_minutes": 45},
            {"round_type": "panel", "name": "Panel Interview", "order": 4, "duration_minutes": 60},
            {"round_type": "final", "name": "Final Round", "order": 5, "duration_minutes": 45},
        ]
        rounds = []
        for d in defaults:
            rounds.append(InterviewRound.objects.create(job_position=job, **d))
        return Response(InterviewRoundSerializer(rounds, many=True).data, status=201)


# ─── Candidate ────────────────────────────────────────────────
class CandidateViewSet(viewsets.ModelViewSet):
    queryset = Candidate.objects.select_related("job_position").all()
    parser_classes = [MultiPartParser, FormParser, JSONParser]
    filterset_fields = ["job_position", "stage", "suggested_action", "guardrail_passed"]
    search_fields = ["first_name", "last_name", "email"]
    ordering_fields = ["created_at", "overall_score", "stage"]

    def get_serializer_class(self):
        if self.action == "list":
            return CandidateListSerializer
        if self.action == "create":
            return CandidateCreateSerializer
        return CandidateDetailSerializer

    @action(detail=True, methods=["post"])
    def evaluate(self, request, pk=None):
        candidate = self.get_object()
        run_audit = request.data.get("run_bias_audit", True)
        task = run_pipeline_task.delay(str(candidate.id), run_bias_audit=run_audit)
        return Response({"task_id": str(task.id), "status": "queued"})

    @action(detail=True, methods=["post"])
    def run_agent(self, request, pk=None):
        candidate = self.get_object()
        agent_type = request.data.get("agent_type")
        if agent_type not in ("parser", "guardrail", "scorer", "summarizer", "bias_auditor"):
            return Response({"error": "Invalid agent_type"}, status=400)
        task = run_single_agent_task.delay(str(candidate.id), agent_type)
        return Response({"task_id": str(task.id), "status": "queued"})

    @action(detail=True, methods=["post"])
    def update_stage(self, request, pk=None):
        candidate = self.get_object()
        new_stage = request.data.get("stage")
        if new_stage not in dict(Candidate.Stage.choices):
            return Response({"error": "Invalid stage"}, status=400)
        old_stage = candidate.stage
        candidate.stage = new_stage
        candidate.save(update_fields=["stage"])
        ActivityLog.objects.create(
            event_type=ActivityLog.EventType.STAGE_CHANGED,
            candidate=candidate,
            job_position=candidate.job_position,
            message=f"Stage changed from {old_stage} to {new_stage}",
        )
        # Auto-setup interviews when shortlisted
        if new_stage == Candidate.Stage.SHORTLISTED:
            _auto_setup_interviews(candidate)
        return Response(CandidateDetailSerializer(candidate).data)

    @action(detail=True, methods=["post"])
    def review(self, request, pk=None):
        candidate = self.get_object()
        candidate.reviewer_notes = request.data.get("notes", "")
        candidate.reviewer_decision = request.data.get("decision", "")
        new_stage = request.data.get("stage")
        if new_stage and new_stage in dict(Candidate.Stage.choices):
            candidate.stage = new_stage
        candidate.save()
        ActivityLog.objects.create(
            event_type=ActivityLog.EventType.DECISION_MADE,
            candidate=candidate,
            job_position=candidate.job_position,
            message=f"Reviewed: {candidate.reviewer_decision}",
        )
        # Auto-setup interviews when shortlisted
        if new_stage == Candidate.Stage.SHORTLISTED:
            _auto_setup_interviews(candidate)
        return Response(CandidateDetailSerializer(candidate).data)

    @action(detail=True, methods=["get"])
    def bias_report(self, request, pk=None):
        candidate = self.get_object()
        probes = BiasProbe.objects.filter(candidate=candidate)
        return Response({
            "candidate_id": str(candidate.id),
            "candidate_name": candidate.full_name,
            "audit_results": candidate.bias_audit_results,
            "probes": BiasProbeSerializer(probes, many=True).data,
            "flags": candidate.bias_flags,
        })

    @action(detail=True, methods=["post"])
    def setup_interviews(self, request, pk=None):
        """Manually trigger interview setup for a candidate."""
        candidate = self.get_object()
        interviews = _auto_setup_interviews(candidate)
        return Response(InterviewListSerializer(interviews, many=True).data, status=201)

    @action(detail=True, methods=["post"])
    def final_evaluation(self, request, pk=None):
        """Submit final evaluation after all interviews are complete."""
        candidate = self.get_object()
        candidate.final_score = request.data.get("final_score")
        candidate.final_recommendation = request.data.get("final_recommendation", "")
        candidate.final_notes = request.data.get("final_notes", "")
        new_stage = request.data.get("stage", Candidate.Stage.FINAL_EVALUATION)
        candidate.stage = new_stage
        candidate.save()
        ActivityLog.objects.create(
            event_type=ActivityLog.EventType.DECISION_MADE,
            candidate=candidate,
            job_position=candidate.job_position,
            message=f"Final evaluation: {candidate.final_recommendation} (score: {candidate.final_score})",
        )
        return Response(CandidateDetailSerializer(candidate).data)

    @action(detail=True, methods=["post"])
    def create_offer(self, request, pk=None):
        """Create an offer for this candidate."""
        candidate = self.get_object()
        data = request.data.copy()
        data["candidate"] = str(candidate.id)
        data["job_position"] = str(candidate.job_position.id)
        serializer = OfferCreateSerializer(data=data)
        serializer.is_valid(raise_exception=True)
        offer = serializer.save()
        candidate.stage = Candidate.Stage.OFFER_DRAFTING
        candidate.save(update_fields=["stage"])
        ActivityLog.objects.create(
            event_type=ActivityLog.EventType.OFFER_CREATED,
            candidate=candidate,
            job_position=candidate.job_position,
            message=f"Offer created for {candidate.full_name}: ${offer.salary}",
        )
        return Response(OfferDetailSerializer(offer).data, status=201)


# ─── Agent Execution ──────────────────────────────────────────
class AgentExecutionViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = AgentExecution.objects.select_related("candidate").all()
    serializer_class = AgentExecutionSerializer
    filterset_fields = ["agent_type", "status", "candidate"]


# ─── Interview ────────────────────────────────────────────────
class InterviewViewSet(viewsets.ModelViewSet):
    queryset = Interview.objects.select_related("candidate", "interviewer", "interview_round").all()
    filterset_fields = ["interview_type", "status", "candidate"]

    def get_serializer_class(self):
        if self.action == "list":
            return InterviewListSerializer
        if self.action == "retrieve":
            return InterviewDetailSerializer
        return InterviewSerializer

    def retrieve(self, request, *args, **kwargs):
        """Auto-assign hiring manager as panel lead if no panel members exist."""
        interview = self.get_object()
        if not interview.panel_members.exists():
            hiring_manager = interview.candidate.job_position.created_by
            if hiring_manager:
                panel, created = InterviewPanel.objects.get_or_create(
                    interview=interview,
                    interviewer=hiring_manager,
                    defaults={"role": InterviewPanel.PanelRole.LEAD},
                )
                if created:
                    InterviewFeedback.objects.get_or_create(
                        interview=interview,
                        interviewer=hiring_manager,
                    )
        serializer = self.get_serializer(interview)
        return Response(serializer.data)

    @action(detail=True, methods=["post"])
    def generate_questions(self, request, pk=None):
        from fairhire.agents.llm_client import chat_json
        interview = self.get_object()
        candidate = interview.candidate
        messages = [
            {"role": "system", "content": "Generate 5-8 interview questions tailored to this candidate. Return JSON: {\"questions\": [\"q1\", ...]}"},
            {"role": "user", "content": (
                f"Position: {candidate.job_position.title}\n"
                f"Requirements: {candidate.job_position.requirements}\n"
                f"Candidate Skills: {candidate.skills}\n"
                f"Experience: {candidate.experience_years} years\n"
                f"Interview Type: {interview.interview_type}\n"
                f"Evaluation Summary: {candidate.summary_results}"
            )},
        ]
        try:
            result = chat_json(messages)
            interview.ai_suggested_questions = result.get("questions", [])
            interview.save(update_fields=["ai_suggested_questions"])
            return Response({"questions": interview.ai_suggested_questions})
        except Exception as e:
            return Response({"error": str(e)}, status=500)

    @action(detail=True, methods=["post"])
    def schedule(self, request, pk=None):
        """Schedule an interview with date/time and location."""
        interview = self.get_object()
        interview.scheduled_at = request.data.get("scheduled_at")
        interview.location = request.data.get("location", "")
        interview.duration_minutes = request.data.get("duration_minutes", interview.duration_minutes)
        interview.status = Interview.Status.SCHEDULED
        interview.save()
        candidate = interview.candidate
        stage_map = {
            "phone": Candidate.Stage.PHONE_SCREEN,
            "technical": Candidate.Stage.TECHNICAL_INTERVIEW,
            "behavioral": Candidate.Stage.BEHAVIORAL_INTERVIEW,
            "panel": Candidate.Stage.PANEL_INTERVIEW,
            "final": Candidate.Stage.FINAL_INTERVIEW,
        }
        new_stage = stage_map.get(interview.interview_type, Candidate.Stage.INTERVIEW_SETUP)
        if candidate.stage in [Candidate.Stage.SHORTLISTED, Candidate.Stage.INTERVIEW_SETUP] or candidate.stage == new_stage:
            candidate.stage = new_stage
            candidate.save(update_fields=["stage"])
        ActivityLog.objects.create(
            event_type=ActivityLog.EventType.INTERVIEW_SCHEDULED,
            candidate=candidate,
            job_position=candidate.job_position,
            message=f"{interview.get_interview_type_display()} scheduled for {candidate.full_name}",
        )
        return Response(InterviewDetailSerializer(interview).data)

    @action(detail=True, methods=["post"])
    def complete(self, request, pk=None):
        """Mark interview as completed and compute rating."""
        interview = self.get_object()
        interview.status = Interview.Status.COMPLETED
        interview.notes = request.data.get("notes", interview.notes)
        interview.save()
        interview.compute_overall_rating()
        ActivityLog.objects.create(
            event_type=ActivityLog.EventType.INTERVIEW_COMPLETED,
            candidate=interview.candidate,
            job_position=interview.candidate.job_position,
            message=f"{interview.get_interview_type_display()} completed for {interview.candidate.full_name}. Rating: {interview.overall_rating or 'N/A'}",
        )
        candidate = interview.candidate
        all_interviews = candidate.interviews.exclude(status=Interview.Status.CANCELLED)
        if all_interviews.exists() and all(i.status == Interview.Status.COMPLETED for i in all_interviews):
            candidate.stage = Candidate.Stage.INTERVIEW_COMPLETE
            candidate.save(update_fields=["stage"])
        return Response(InterviewDetailSerializer(interview).data)

    @action(detail=True, methods=["post"])
    def add_panel(self, request, pk=None):
        """Add an interviewer to the panel."""
        interview = self.get_object()
        interviewer_id = request.data.get("interviewer_id")
        role = request.data.get("role", "member")
        try:
            interviewer = User.objects.get(id=interviewer_id)
        except User.DoesNotExist:
            return Response({"error": "User not found"}, status=404)
        panel, created = InterviewPanel.objects.get_or_create(
            interview=interview,
            interviewer=interviewer,
            defaults={"role": role},
        )
        if not created:
            return Response({"error": "Interviewer already on panel"}, status=400)
        InterviewFeedback.objects.get_or_create(
            interview=interview,
            interviewer=interviewer,
        )
        return Response(InterviewPanelSerializer(panel).data, status=201)

    @action(detail=True, methods=["post"])
    def remove_panel(self, request, pk=None):
        """Remove an interviewer from the panel."""
        interview = self.get_object()
        interviewer_id = request.data.get("interviewer_id")
        deleted, _ = InterviewPanel.objects.filter(
            interview=interview,
            interviewer_id=interviewer_id,
        ).delete()
        if deleted:
            InterviewFeedback.objects.filter(
                interview=interview,
                interviewer_id=interviewer_id,
                submitted=False,
            ).delete()
            return Response({"status": "removed"})
        return Response({"error": "Not found"}, status=404)


# ─── Interview Round ──────────────────────────────────────────
class InterviewRoundViewSet(viewsets.ModelViewSet):
    queryset = InterviewRound.objects.select_related("job_position").all()
    serializer_class = InterviewRoundSerializer
    filterset_fields = ["job_position", "round_type"]
    ordering_fields = ["order"]


# ─── Interview Feedback ──────────────────────────────────────
class InterviewFeedbackViewSet(viewsets.ModelViewSet):
    queryset = InterviewFeedback.objects.select_related("interview", "interviewer").all()
    serializer_class = InterviewFeedbackSerializer
    filterset_fields = ["interview", "interviewer", "submitted", "recommendation"]

    @action(detail=True, methods=["post"])
    def submit(self, request, pk=None):
        """Submit feedback (marks as submitted and computes interview rating)."""
        feedback = self.get_object()
        for field in ["technical_score", "communication_score", "problem_solving_score",
                      "culture_fit_score", "leadership_score", "overall_score",
                      "recommendation", "strengths", "weaknesses", "notes"]:
            if field in request.data:
                setattr(feedback, field, request.data[field])
        if "detailed_scores" in request.data:
            feedback.detailed_scores = request.data["detailed_scores"]
        feedback.submitted = True
        feedback.submitted_at = timezone.now()
        feedback.save()
        feedback.interview.compute_overall_rating()
        ActivityLog.objects.create(
            event_type=ActivityLog.EventType.FEEDBACK_SUBMITTED,
            candidate=feedback.interview.candidate,
            job_position=feedback.interview.candidate.job_position,
            message=f"Interview feedback submitted by {feedback.interviewer.get_full_name()}: {feedback.recommendation}",
        )
        return Response(InterviewFeedbackSerializer(feedback).data)


# ─── Offer ────────────────────────────────────────────────────
class OfferViewSet(viewsets.ModelViewSet):
    queryset = Offer.objects.select_related("candidate", "job_position", "created_by").all()
    filterset_fields = ["status", "candidate", "job_position"]
    ordering_fields = ["created_at", "salary"]

    def get_serializer_class(self):
        if self.action == "list":
            return OfferListSerializer
        if self.action == "create":
            return OfferCreateSerializer
        return OfferDetailSerializer

    @action(detail=True, methods=["post"])
    def submit_for_approval(self, request, pk=None):
        offer = self.get_object()
        approver_ids = request.data.get("approver_ids", [])
        if not approver_ids:
            return Response({"error": "At least one approver required"}, status=400)
        offer.status = Offer.Status.PENDING_APPROVAL
        offer.save(update_fields=["status"])
        for i, uid in enumerate(approver_ids, 1):
            try:
                approver = User.objects.get(id=uid)
                OfferApproval.objects.get_or_create(
                    offer=offer, approver=approver, defaults={"order": i},
                )
            except User.DoesNotExist:
                pass
        offer.candidate.stage = Candidate.Stage.OFFER_APPROVAL
        offer.candidate.save(update_fields=["stage"])
        return Response(OfferDetailSerializer(offer).data)

    @action(detail=True, methods=["post"])
    def approve(self, request, pk=None):
        offer = self.get_object()
        approver_id = request.data.get("approver_id")
        comments = request.data.get("comments", "")
        try:
            approval = OfferApproval.objects.get(offer=offer, approver_id=approver_id)
        except OfferApproval.DoesNotExist:
            return Response({"error": "Not an approver for this offer"}, status=404)
        approval.decision = OfferApproval.Decision.APPROVED
        approval.comments = comments
        approval.decided_at = timezone.now()
        approval.save()
        if all(a.decision == OfferApproval.Decision.APPROVED for a in offer.approvals.all()):
            offer.status = Offer.Status.APPROVED
            offer.save(update_fields=["status"])
            offer.candidate.stage = Candidate.Stage.APPROVED_FOR_OFFER
            offer.candidate.save(update_fields=["stage"])
        return Response(OfferDetailSerializer(offer).data)

    @action(detail=True, methods=["post"])
    def reject_approval(self, request, pk=None):
        offer = self.get_object()
        approver_id = request.data.get("approver_id")
        comments = request.data.get("comments", "")
        try:
            approval = OfferApproval.objects.get(offer=offer, approver_id=approver_id)
        except OfferApproval.DoesNotExist:
            return Response({"error": "Not an approver for this offer"}, status=404)
        approval.decision = OfferApproval.Decision.REJECTED
        approval.comments = comments
        approval.decided_at = timezone.now()
        approval.save()
        return Response(OfferDetailSerializer(offer).data)

    @action(detail=True, methods=["post"])
    def send_offer(self, request, pk=None):
        offer = self.get_object()
        if offer.status not in [Offer.Status.APPROVED, Offer.Status.DRAFTING]:
            return Response({"error": "Offer must be approved before sending"}, status=400)
        offer.status = Offer.Status.SENT
        offer.sent_at = timezone.now()
        if not offer.expires_at:
            offer.expires_at = timezone.now() + timedelta(days=7)
        offer.save()
        offer.candidate.stage = Candidate.Stage.OFFER_EXTENDED
        offer.candidate.save(update_fields=["stage"])
        ActivityLog.objects.create(
            event_type=ActivityLog.EventType.OFFER_SENT,
            candidate=offer.candidate,
            job_position=offer.job_position,
            message=f"Offer sent to {offer.candidate.full_name}: ${offer.salary}",
        )
        return Response(OfferDetailSerializer(offer).data)

    @action(detail=True, methods=["post"])
    def candidate_respond(self, request, pk=None):
        offer = self.get_object()
        response_type = request.data.get("response")
        response_notes = request.data.get("notes", "")
        offer.responded_at = timezone.now()
        offer.candidate_response = response_notes

        if response_type == "accepted":
            offer.status = Offer.Status.ACCEPTED
            offer.candidate.stage = Candidate.Stage.OFFER_ACCEPTED
            ActivityLog.objects.create(
                event_type=ActivityLog.EventType.OFFER_ACCEPTED,
                candidate=offer.candidate,
                job_position=offer.job_position,
                message=f"{offer.candidate.full_name} accepted the offer!",
            )
        elif response_type == "declined":
            offer.status = Offer.Status.DECLINED
            offer.decline_reason = response_notes
            offer.candidate.stage = Candidate.Stage.OFFER_DECLINED
            ActivityLog.objects.create(
                event_type=ActivityLog.EventType.OFFER_DECLINED,
                candidate=offer.candidate,
                job_position=offer.job_position,
                message=f"{offer.candidate.full_name} declined the offer. Reason: {response_notes}",
            )
        elif response_type == "negotiating":
            offer.status = Offer.Status.NEGOTIATING
            offer.negotiation_notes = response_notes
            offer.candidate.stage = Candidate.Stage.OFFER_NEGOTIATION

        offer.save()
        offer.candidate.save(update_fields=["stage"])
        return Response(OfferDetailSerializer(offer).data)

    @action(detail=True, methods=["post"])
    def revise(self, request, pk=None):
        offer = self.get_object()
        offer.salary = request.data.get("salary", offer.salary)
        offer.signing_bonus = request.data.get("signing_bonus", offer.signing_bonus)
        offer.equity_details = request.data.get("equity_details", offer.equity_details)
        offer.bonus_structure = request.data.get("bonus_structure", offer.bonus_structure)
        offer.start_date = request.data.get("start_date", offer.start_date)
        offer.benefits_summary = request.data.get("benefits_summary", offer.benefits_summary)
        offer.negotiation_notes = request.data.get("negotiation_notes", offer.negotiation_notes)
        offer.counter_offer_details = request.data.get("counter_offer_details", offer.counter_offer_details)
        offer.revision_number += 1
        offer.status = Offer.Status.SENT
        offer.sent_at = timezone.now()
        offer.save()
        return Response(OfferDetailSerializer(offer).data)

    @action(detail=True, methods=["post"])
    def mark_hired(self, request, pk=None):
        offer = self.get_object()
        if offer.status != Offer.Status.ACCEPTED:
            return Response({"error": "Offer must be accepted first"}, status=400)
        offer.candidate.stage = Candidate.Stage.HIRED
        offer.candidate.save(update_fields=["stage"])
        ActivityLog.objects.create(
            event_type=ActivityLog.EventType.DECISION_MADE,
            candidate=offer.candidate,
            job_position=offer.job_position,
            message=f"{offer.candidate.full_name} has been hired!",
        )
        return Response(CandidateDetailSerializer(offer.candidate).data)


# ─── Hiring Team ──────────────────────────────────────────────
class HiringTeamMemberViewSet(viewsets.ModelViewSet):
    queryset = HiringTeamMember.objects.select_related("user", "department").all()
    serializer_class = HiringTeamMemberSerializer
    filterset_fields = ["role", "department", "is_active"]


# ─── Evaluation Template ─────────────────────────────────────
class EvaluationTemplateViewSet(viewsets.ModelViewSet):
    queryset = EvaluationTemplate.objects.all()
    serializer_class = EvaluationTemplateSerializer


# ─── Activity Log ─────────────────────────────────────────────
class ActivityLogViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = ActivityLog.objects.select_related("candidate", "job_position").all()
    serializer_class = ActivityLogSerializer
    filterset_fields = ["event_type", "candidate", "job_position"]


# ─── Users list (for panel assignment) ────────────────────────
@api_view(["GET"])
@permission_classes([permissions.IsAuthenticated])
def users_list(request):
    users = User.objects.all().order_by("first_name")
    return Response(UserMinimalSerializer(users, many=True).data)


# ─── Dashboard Stats ─────────────────────────────────────────
@api_view(["GET"])
@permission_classes([permissions.IsAuthenticated])
def dashboard_stats(request):
    total_candidates = Candidate.objects.count()
    candidates_by_stage = dict(
        Candidate.objects.values_list("stage").annotate(c=Count("id")).values_list("stage", "c")
    )
    avg_score = Candidate.objects.filter(overall_score__isnull=False).aggregate(
        avg=Avg("overall_score")
    )
    bias_flags = BiasProbe.objects.filter(flagged=True).count()
    recent = ActivityLog.objects.all()[:15]

    interviews_scheduled = Interview.objects.filter(status=Interview.Status.SCHEDULED).count()
    interviews_completed = Interview.objects.filter(status=Interview.Status.COMPLETED).count()
    offers_pending = Offer.objects.filter(status__in=[
        Offer.Status.DRAFTING, Offer.Status.PENDING_APPROVAL, Offer.Status.APPROVED,
    ]).count()
    offers_sent = Offer.objects.filter(status=Offer.Status.SENT).count()
    offers_accepted = Offer.objects.filter(status=Offer.Status.ACCEPTED).count()
    offers_declined = Offer.objects.filter(status=Offer.Status.DECLINED).count()
    total_hired = Candidate.objects.filter(stage=Candidate.Stage.HIRED).count()

    return Response({
        "total_jobs": JobPosition.objects.count(),
        "open_jobs": JobPosition.objects.filter(status=JobPosition.Status.OPEN).count(),
        "total_candidates": total_candidates,
        "candidates_reviewed": Candidate.objects.filter(stage=Candidate.Stage.REVIEWED).count(),
        "candidates_shortlisted": Candidate.objects.filter(stage=Candidate.Stage.SHORTLISTED).count(),
        "candidates_rejected": Candidate.objects.filter(stage=Candidate.Stage.REJECTED).count(),
        "avg_score": round(avg_score["avg"] or 0, 3),
        "bias_flags_count": bias_flags,
        "pipeline_stages": candidates_by_stage,
        "recent_activity": ActivityLogSerializer(recent, many=True).data,
        "interviews_scheduled": interviews_scheduled,
        "interviews_completed": interviews_completed,
        "offers_pending": offers_pending,
        "offers_sent": offers_sent,
        "offers_accepted": offers_accepted,
        "offers_declined": offers_declined,
        "total_hired": total_hired,
    })


@api_view(["POST"])
@permission_classes([permissions.IsAuthenticated])
def bulk_evaluate(request):
    serializer = BulkEvaluateSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    result = bulk_evaluate_candidates.delay(
        str(serializer.validated_data["job_position_id"]),
        run_bias_audit=serializer.validated_data["run_bias_audit"],
    )
    return Response({"task_id": str(result.id), "status": "queued"})


# _auto_setup_interviews is imported from fairhire.core.services
