from rest_framework import serializers
from fairhire.core.models import (
    Department, JobPosition, Candidate, AgentExecution,
    BiasProbe, Interview, EvaluationTemplate, ActivityLog,
)


class DepartmentSerializer(serializers.ModelSerializer):
    positions_count = serializers.SerializerMethodField()

    class Meta:
        model = Department
        fields = "__all__"

    def get_positions_count(self, obj):
        return obj.positions.count()


class JobPositionListSerializer(serializers.ModelSerializer):
    department_name = serializers.CharField(source="department.name", read_only=True)
    candidates_count = serializers.SerializerMethodField()
    candidates_reviewed = serializers.SerializerMethodField()

    class Meta:
        model = JobPosition
        fields = [
            "id", "title", "department", "department_name", "status",
            "experience_level", "location", "is_remote", "salary_min",
            "salary_max", "candidates_count", "candidates_reviewed",
            "created_at", "updated_at",
        ]

    def get_candidates_count(self, obj):
        return obj.candidates.count()

    def get_candidates_reviewed(self, obj):
        return obj.candidates.filter(stage=Candidate.Stage.REVIEWED).count()


class JobPositionDetailSerializer(serializers.ModelSerializer):
    department_name = serializers.CharField(source="department.name", read_only=True)

    class Meta:
        model = JobPosition
        fields = "__all__"


class CandidateListSerializer(serializers.ModelSerializer):
    job_title = serializers.CharField(source="job_position.title", read_only=True)
    full_name = serializers.CharField(read_only=True)

    class Meta:
        model = Candidate
        fields = [
            "id", "full_name", "first_name", "last_name", "email",
            "job_position", "job_title", "stage", "overall_score",
            "confidence", "suggested_action", "guardrail_passed",
            "created_at", "updated_at",
        ]


class CandidateDetailSerializer(serializers.ModelSerializer):
    job_title = serializers.CharField(source="job_position.title", read_only=True)
    full_name = serializers.CharField(read_only=True)
    bias_probes = serializers.SerializerMethodField()
    agent_executions = serializers.SerializerMethodField()

    class Meta:
        model = Candidate
        fields = "__all__"

    def get_bias_probes(self, obj):
        return BiasProbeSerializer(obj.bias_probes.all(), many=True).data

    def get_agent_executions(self, obj):
        return AgentExecutionSerializer(obj.agent_executions.all()[:20], many=True).data


class CandidateCreateSerializer(serializers.ModelSerializer):
    resume_file = serializers.FileField(required=False)

    class Meta:
        model = Candidate
        fields = [
            "job_position", "first_name", "last_name", "email",
            "phone", "resume_file", "resume_text",
        ]

    def create(self, validated_data):
        resume_file = validated_data.get("resume_file")
        if resume_file and not validated_data.get("resume_text"):
            validated_data["resume_text"] = self._extract_text(resume_file)
        candidate = super().create(validated_data)
        ActivityLog.objects.create(
            event_type=ActivityLog.EventType.CANDIDATE_CREATED,
            candidate=candidate,
            job_position=candidate.job_position,
            message=f"Candidate {candidate.full_name or 'New'} created",
        )
        return candidate

    def _extract_text(self, file_obj) -> str:
        """Extract text from uploaded file."""
        name = file_obj.name.lower()
        content = file_obj.read()
        if name.endswith(".txt") or name.endswith(".json"):
            return content.decode("utf-8", errors="replace")
        elif name.endswith(".pdf"):
            try:
                import PyPDF2
                import io
                reader = PyPDF2.PdfReader(io.BytesIO(content))
                return "\n".join(page.extract_text() or "" for page in reader.pages)
            except Exception:
                return content.decode("utf-8", errors="replace")
        elif name.endswith(".docx"):
            try:
                import docx
                import io
                doc = docx.Document(io.BytesIO(content))
                return "\n".join(p.text for p in doc.paragraphs)
            except Exception:
                return content.decode("utf-8", errors="replace")
        return content.decode("utf-8", errors="replace")


class AgentExecutionSerializer(serializers.ModelSerializer):
    class Meta:
        model = AgentExecution
        fields = "__all__"


class BiasProbeSerializer(serializers.ModelSerializer):
    class Meta:
        model = BiasProbe
        fields = "__all__"


class InterviewSerializer(serializers.ModelSerializer):
    candidate_name = serializers.CharField(source="candidate.full_name", read_only=True)
    interviewer_name = serializers.SerializerMethodField()

    class Meta:
        model = Interview
        fields = "__all__"

    def get_interviewer_name(self, obj):
        if obj.interviewer:
            return f"{obj.interviewer.first_name} {obj.interviewer.last_name}".strip()
        return None


class EvaluationTemplateSerializer(serializers.ModelSerializer):
    class Meta:
        model = EvaluationTemplate
        fields = "__all__"


class ActivityLogSerializer(serializers.ModelSerializer):
    candidate_name = serializers.SerializerMethodField()

    class Meta:
        model = ActivityLog
        fields = "__all__"

    def get_candidate_name(self, obj):
        return obj.candidate.full_name if obj.candidate else None


class DashboardStatsSerializer(serializers.Serializer):
    total_jobs = serializers.IntegerField()
    open_jobs = serializers.IntegerField()
    total_candidates = serializers.IntegerField()
    candidates_reviewed = serializers.IntegerField()
    candidates_shortlisted = serializers.IntegerField()
    candidates_rejected = serializers.IntegerField()
    avg_score = serializers.FloatField()
    bias_flags_count = serializers.IntegerField()
    pipeline_stages = serializers.DictField()
    recent_activity = ActivityLogSerializer(many=True)


class BulkEvaluateSerializer(serializers.Serializer):
    job_position_id = serializers.UUIDField()
    run_bias_audit = serializers.BooleanField(default=True)
