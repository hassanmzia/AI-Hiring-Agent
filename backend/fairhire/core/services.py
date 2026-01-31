"""Shared business logic for the hiring pipeline."""

import logging

from fairhire.core.models import (
    Candidate, Interview, InterviewRound, InterviewPanel,
    InterviewFeedback, ActivityLog,
)

logger = logging.getLogger("fairhire.core")


def auto_setup_interviews(candidate: Candidate) -> list:
    """Create draft interviews for a shortlisted candidate based on job's interview rounds.

    If the job position has no interview rounds defined, creates a default set
    (Phone Screen, Technical Interview, Behavioral Interview). Skips any rounds
    that already have an interview for this candidate.

    Returns a list of newly created Interview objects.
    """
    job = candidate.job_position
    rounds = job.interview_rounds.order_by("order")

    if not rounds.exists():
        defaults = [
            {"round_type": "phone_screen", "name": "Phone Screen", "order": 1, "duration_minutes": 30},
            {"round_type": "technical", "name": "Technical Interview", "order": 2, "duration_minutes": 60},
            {"round_type": "behavioral", "name": "Behavioral Interview", "order": 3, "duration_minutes": 45},
        ]
        for d in defaults:
            InterviewRound.objects.create(job_position=job, **d)
        rounds = job.interview_rounds.order_by("order")

    round_type_map = {
        "phone_screen": "phone",
        "technical": "technical",
        "behavioral": "behavioral",
        "panel": "panel",
        "final": "final",
        "custom": "technical",
    }

    interviews = []
    for round_obj in rounds:
        if candidate.interviews.filter(interview_round=round_obj).exists():
            continue
        interview = Interview.objects.create(
            candidate=candidate,
            interview_round=round_obj,
            interview_type=round_type_map.get(round_obj.round_type, "technical"),
            duration_minutes=round_obj.duration_minutes,
            status=Interview.Status.DRAFT,
        )
        interviews.append(interview)

    if interviews:
        candidate.stage = Candidate.Stage.INTERVIEW_SETUP
        candidate.save(update_fields=["stage"])

        # Auto-assign the job creator (hiring manager) as panel lead
        # so feedback slots are immediately available.
        hiring_manager = job.created_by
        if hiring_manager:
            for interview in interviews:
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

        ActivityLog.objects.create(
            event_type=ActivityLog.EventType.INTERVIEW_SCHEDULED,
            candidate=candidate,
            job_position=job,
            message=f"{len(interviews)} interview round(s) set up for {candidate.full_name}",
        )
        logger.info(
            f"Auto-created {len(interviews)} interview(s) for candidate "
            f"{candidate.id} ({candidate.full_name})"
        )

    return interviews
