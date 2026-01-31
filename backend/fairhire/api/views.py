import logging

from django.db.models import Avg, Count, Q
from rest_framework import viewsets, status, permissions
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser

from fairhire.core.models import (
    Department, JobPosition, Candidate, AgentExecution,
    BiasProbe, Interview, EvaluationTemplate, ActivityLog,
)
from fairhire.agents.tasks import run_pipeline_task, run_single_agent_task, bulk_evaluate_candidates
from .serializers import (
    DepartmentSerializer, JobPositionListSerializer, JobPositionDetailSerializer,
    CandidateListSerializer, CandidateDetailSerializer, CandidateCreateSerializer,
    AgentExecutionSerializer, BiasProbeSerializer, InterviewSerializer,
    EvaluationTemplateSerializer, ActivityLogSerializer, BulkEvaluateSerializer,
)

logger = logging.getLogger("fairhire.api")


class DepartmentViewSet(viewsets.ModelViewSet):
    queryset = Department.objects.all()
    serializer_class = DepartmentSerializer
    search_fields = ["name"]


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
        """Kick off evaluation pipeline for all new candidates in this position."""
        job = self.get_object()
        run_audit = request.data.get("run_bias_audit", True)
        result = bulk_evaluate_candidates.delay(str(job.id), run_bias_audit=run_audit)
        return Response({"task_id": str(result.id), "status": "queued"})

    @action(detail=True, methods=["get"])
    def pipeline_stats(self, request, pk=None):
        """Get pipeline stage distribution for this position."""
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
        """Run the full evaluation pipeline on this candidate."""
        candidate = self.get_object()
        run_audit = request.data.get("run_bias_audit", True)
        task = run_pipeline_task.delay(str(candidate.id), run_bias_audit=run_audit)
        return Response({"task_id": str(task.id), "status": "queued"})

    @action(detail=True, methods=["post"])
    def run_agent(self, request, pk=None):
        """Run a specific agent on this candidate."""
        candidate = self.get_object()
        agent_type = request.data.get("agent_type")
        if agent_type not in ("parser", "guardrail", "scorer", "summarizer", "bias_auditor"):
            return Response({"error": "Invalid agent_type"}, status=400)
        task = run_single_agent_task.delay(str(candidate.id), agent_type)
        return Response({"task_id": str(task.id), "status": "queued"})

    @action(detail=True, methods=["post"])
    def update_stage(self, request, pk=None):
        """Manually update candidate stage."""
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
        return Response(CandidateDetailSerializer(candidate).data)

    @action(detail=True, methods=["post"])
    def review(self, request, pk=None):
        """Submit human review for a candidate."""
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
        return Response(CandidateDetailSerializer(candidate).data)

    @action(detail=True, methods=["get"])
    def bias_report(self, request, pk=None):
        """Get detailed bias audit report for a candidate."""
        candidate = self.get_object()
        probes = BiasProbe.objects.filter(candidate=candidate)
        return Response({
            "candidate_id": str(candidate.id),
            "candidate_name": candidate.full_name,
            "audit_results": candidate.bias_audit_results,
            "probes": BiasProbeSerializer(probes, many=True).data,
            "flags": candidate.bias_flags,
        })


class AgentExecutionViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = AgentExecution.objects.select_related("candidate").all()
    serializer_class = AgentExecutionSerializer
    filterset_fields = ["agent_type", "status", "candidate"]


class InterviewViewSet(viewsets.ModelViewSet):
    queryset = Interview.objects.select_related("candidate", "interviewer").all()
    serializer_class = InterviewSerializer
    filterset_fields = ["interview_type", "status", "candidate"]

    @action(detail=True, methods=["post"])
    def generate_questions(self, request, pk=None):
        """AI-generate interview questions based on candidate profile."""
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


class EvaluationTemplateViewSet(viewsets.ModelViewSet):
    queryset = EvaluationTemplate.objects.all()
    serializer_class = EvaluationTemplateSerializer


class ActivityLogViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = ActivityLog.objects.select_related("candidate", "job_position").all()
    serializer_class = ActivityLogSerializer
    filterset_fields = ["event_type", "candidate", "job_position"]


@api_view(["GET"])
@permission_classes([permissions.AllowAny])
def dashboard_stats(request):
    """Global dashboard statistics."""
    total_candidates = Candidate.objects.count()
    candidates_by_stage = dict(
        Candidate.objects.values_list("stage").annotate(c=Count("id")).values_list("stage", "c")
    )
    avg_score = Candidate.objects.filter(overall_score__isnull=False).aggregate(
        avg=Avg("overall_score")
    )
    bias_flags = BiasProbe.objects.filter(flagged=True).count()
    recent = ActivityLog.objects.all()[:15]

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
    })


@api_view(["POST"])
@permission_classes([permissions.AllowAny])
def bulk_evaluate(request):
    """Bulk evaluate all new candidates for a position."""
    serializer = BulkEvaluateSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    result = bulk_evaluate_candidates.delay(
        str(serializer.validated_data["job_position_id"]),
        run_bias_audit=serializer.validated_data["run_bias_audit"],
    )
    return Response({"task_id": str(result.id), "status": "queued"})
