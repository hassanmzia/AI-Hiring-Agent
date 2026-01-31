from django.contrib import admin
from .models import (
    Department, JobPosition, Candidate, AgentExecution,
    BiasProbe, Interview, EvaluationTemplate, ActivityLog,
)


@admin.register(Department)
class DepartmentAdmin(admin.ModelAdmin):
    list_display = ["name", "created_at"]
    search_fields = ["name"]


@admin.register(JobPosition)
class JobPositionAdmin(admin.ModelAdmin):
    list_display = ["title", "department", "status", "experience_level", "created_at"]
    list_filter = ["status", "experience_level", "department"]
    search_fields = ["title", "description"]


@admin.register(Candidate)
class CandidateAdmin(admin.ModelAdmin):
    list_display = ["full_name", "job_position", "stage", "overall_score", "suggested_action", "created_at"]
    list_filter = ["stage", "suggested_action", "guardrail_passed"]
    search_fields = ["first_name", "last_name", "email"]
    readonly_fields = ["parsed_data", "guardrail_results", "scoring_results", "summary_results", "bias_audit_results"]


@admin.register(AgentExecution)
class AgentExecutionAdmin(admin.ModelAdmin):
    list_display = ["agent_type", "candidate", "status", "duration_seconds", "created_at"]
    list_filter = ["agent_type", "status"]


@admin.register(BiasProbe)
class BiasProbeAdmin(admin.ModelAdmin):
    list_display = ["candidate", "probe_type", "scenario", "original_score", "probe_score", "delta", "flagged"]
    list_filter = ["probe_type", "flagged"]


@admin.register(Interview)
class InterviewAdmin(admin.ModelAdmin):
    list_display = ["candidate", "interview_type", "interviewer", "scheduled_at", "status"]
    list_filter = ["interview_type", "status"]


@admin.register(EvaluationTemplate)
class EvaluationTemplateAdmin(admin.ModelAdmin):
    list_display = ["name", "created_at"]


@admin.register(ActivityLog)
class ActivityLogAdmin(admin.ModelAdmin):
    list_display = ["event_type", "candidate", "message", "created_at"]
    list_filter = ["event_type"]
