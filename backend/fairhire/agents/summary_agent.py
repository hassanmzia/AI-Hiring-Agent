"""Summary Agent — consolidates all evaluation data into actionable summary.

Maps to the notebook's summary_tool. Enhanced with detailed reasoning.
"""

import logging
import time

from fairhire.core.models import Candidate, AgentExecution
from .llm_client import chat_json

logger = logging.getLogger("fairhire.agents")

SYSTEM_PROMPT = """You are a helpful and analytical assistant responsible for summarizing candidate evaluations.
Your task is to review the candidate's details, identify their key strengths and weaknesses,
and provide a reasoned recommendation regarding acceptance or rejection.

Your response must strictly follow the JSON format below:
{
    "pros": ["strength1", "strength2", ...],
    "cons": ["weakness1", "weakness2", ...],
    "suggested_action": "Accept" | "Reject" | "Further Evaluation Needed",
    "detailed_reasoning": "Comprehensive explanation supporting the suggested action",
    "risk_factors": ["risk1", ...],
    "interview_recommendations": ["topic to probe in interview", ...],
    "overall_assessment": "Brief 1-2 sentence verdict"
}

Rules:
- Base your assessment ONLY on the provided data
- Be fair and objective
- Consider guardrail results when making recommendations
- Flag any bias concerns from the data
"""


def run(candidate: Candidate) -> dict:
    """Generate evaluation summary for a candidate."""
    start = time.time()
    execution = AgentExecution.objects.create(
        candidate=candidate,
        agent_type=AgentExecution.AgentType.SUMMARIZER,
        status=AgentExecution.Status.RUNNING,
        input_data={
            "has_parsed_data": bool(candidate.parsed_data),
            "has_guardrail_results": bool(candidate.guardrail_results),
            "has_scoring_results": bool(candidate.scoring_results),
        },
    )

    try:
        user_content = (
            f"Here are the candidate details:\n{_format_candidate_data(candidate)}\n\n"
            f"Here are the guardrailing results:\n{candidate.guardrail_results}\n\n"
            f"Here are the scoring results:\n{candidate.scoring_results}\n\n"
            f"Job Position: {candidate.job_position.title}\n"
            f"Job Requirements: {candidate.job_position.requirements}\n"
        )

        messages = [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": user_content},
        ]

        summary = chat_json(messages)

        candidate.summary_results = summary
        candidate.suggested_action = summary.get("suggested_action", "")
        candidate.stage = Candidate.Stage.SUMMARIZED
        candidate.save()

        duration = time.time() - start
        execution.status = AgentExecution.Status.COMPLETED
        execution.output_data = summary
        execution.duration_seconds = round(duration, 2)
        execution.save()

        logger.info(f"Summary agent completed for candidate {candidate.id}: action={summary.get('suggested_action')}")
        return summary

    except Exception as e:
        duration = time.time() - start
        execution.status = AgentExecution.Status.FAILED
        execution.error_message = str(e)
        execution.duration_seconds = round(duration, 2)
        execution.save()
        logger.error(f"Summary agent failed for candidate {candidate.id}: {e}")
        raise


def _format_candidate_data(candidate: Candidate) -> str:
    """Format candidate data for summary prompt."""
    parsed = candidate.parsed_data or {}
    return (
        f"Name: {candidate.full_name}\n"
        f"Experience: {candidate.experience_years or 'Unknown'} years\n"
        f"Skills: {', '.join(candidate.skills) if candidate.skills else 'Not specified'}\n"
        f"Education: {candidate.education}\n"
        f"Current Title: {parsed.get('current_title', 'Unknown')}\n"
        f"Certifications: {parsed.get('certifications', [])}\n"
        f"Notable Achievements: {parsed.get('notable_achievements', [])}\n"
        f"Management Experience: {parsed.get('management_experience', 'Unknown')}\n"
        f"Career Gaps: {parsed.get('career_gaps', [])}\n"
    )
