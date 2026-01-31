"""Responsible AI Analytics — aggregated fairness metrics and reporting.

Provides system-wide bias analytics, fairness scores, and compliance reporting.
"""

import logging
from collections import defaultdict

from django.db.models import Avg, Count, Q, F

from fairhire.core.models import Candidate, BiasProbe, JobPosition, AgentExecution

logger = logging.getLogger("fairhire.responsible_ai")


def get_fairness_dashboard(job_position_id: str | None = None) -> dict:
    """Compute aggregate fairness metrics across candidates."""
    probe_qs = BiasProbe.objects.all()
    candidate_qs = Candidate.objects.all()

    if job_position_id:
        probe_qs = probe_qs.filter(candidate__job_position_id=job_position_id)
        candidate_qs = candidate_qs.filter(job_position_id=job_position_id)

    # Probe statistics by type
    probe_stats = (
        probe_qs.values("probe_type")
        .annotate(
            total=Count("id"),
            flagged=Count("id", filter=Q(flagged=True)),
            avg_delta=Avg("delta"),
        )
    )

    # Score distribution
    score_dist = {
        "0.0-0.2": candidate_qs.filter(overall_score__gte=0, overall_score__lt=0.2).count(),
        "0.2-0.4": candidate_qs.filter(overall_score__gte=0.2, overall_score__lt=0.4).count(),
        "0.4-0.6": candidate_qs.filter(overall_score__gte=0.4, overall_score__lt=0.6).count(),
        "0.6-0.8": candidate_qs.filter(overall_score__gte=0.6, overall_score__lt=0.8).count(),
        "0.8-1.0": candidate_qs.filter(overall_score__gte=0.8, overall_score__lte=1.0).count(),
    }

    # Top flagged scenarios
    top_flags = list(
        probe_qs.filter(flagged=True)
        .values("scenario")
        .annotate(count=Count("id"), avg_delta=Avg("delta"))
        .order_by("-count")[:10]
    )

    # PII detection stats
    pii_detected = candidate_qs.filter(
        bias_audit_results__pii_scan__count__gt=0
    ).count()

    # Adversarial injection test results
    adversarial_probes = probe_qs.filter(probe_type=BiasProbe.ProbeType.ADVERSARIAL)
    adversarial_flagged = adversarial_probes.filter(flagged=True).count()

    return {
        "total_candidates_audited": candidate_qs.exclude(bias_audit_results={}).count(),
        "total_probes": probe_qs.count(),
        "total_flags": probe_qs.filter(flagged=True).count(),
        "flag_rate": (
            round(probe_qs.filter(flagged=True).count() / probe_qs.count(), 3)
            if probe_qs.count() > 0 else 0
        ),
        "probe_stats": list(probe_stats),
        "score_distribution": score_dist,
        "top_flagged_scenarios": top_flags,
        "pii_detected_count": pii_detected,
        "adversarial_test_results": {
            "total": adversarial_probes.count(),
            "flagged": adversarial_flagged,
            "pass_rate": (
                round(1 - adversarial_flagged / adversarial_probes.count(), 3)
                if adversarial_probes.count() > 0 else 1.0
            ),
        },
    }


def get_agent_performance() -> dict:
    """Get performance metrics for each agent type."""
    stats = (
        AgentExecution.objects.values("agent_type")
        .annotate(
            total=Count("id"),
            completed=Count("id", filter=Q(status=AgentExecution.Status.COMPLETED)),
            failed=Count("id", filter=Q(status=AgentExecution.Status.FAILED)),
            avg_duration=Avg("duration_seconds"),
            avg_tokens=Avg("llm_tokens_used"),
        )
    )
    return {"agents": list(stats)}
