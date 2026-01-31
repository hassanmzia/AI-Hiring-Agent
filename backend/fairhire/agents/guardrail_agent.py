"""Guardrail Agent — checks candidates against mandatory policies.

Maps to the notebook's guardrail_tool. Enhanced with more comprehensive checks.
"""

import logging
import time

from fairhire.core.models import Candidate, AgentExecution

logger = logging.getLogger("fairhire.agents")


def _check_experience(experience_years: float | None, min_required: int) -> dict:
    """Check minimum experience requirement."""
    if experience_years is None:
        return {"pass": False, "reason": "Experience years not available in resume"}
    if experience_years < min_required:
        return {
            "pass": False,
            "reason": f"Candidate has {experience_years} years of experience, "
                      f"below minimum of {min_required} years required",
        }
    return {
        "pass": True,
        "reason": f"Candidate has {experience_years} years of experience, "
                  f"meets minimum of {min_required} years",
    }


def _check_age(age: int | None) -> dict:
    """Check legal working age. Only flags if age is explicitly below 18."""
    if age is None:
        return {"pass": True, "reason": "Age not specified — no age-based restriction applied"}
    if age < 18:
        return {"pass": False, "reason": f"Candidate age ({age}) is below legal working age of 18"}
    return {"pass": True, "reason": f"Candidate age ({age}) meets legal working age requirement"}


def _check_required_skills(candidate_skills: list, required_keywords: list[str]) -> dict:
    """Check if candidate has minimum required skill overlap."""
    if not required_keywords:
        return {"pass": True, "reason": "No specific skill requirements defined"}
    candidate_lower = {s.lower() for s in candidate_skills}
    required_lower = {s.lower() for s in required_keywords}
    matches = candidate_lower & required_lower
    ratio = len(matches) / len(required_lower) if required_lower else 0
    if ratio < 0.2:
        return {
            "pass": False,
            "reason": f"Only {len(matches)}/{len(required_lower)} required skills matched ({ratio:.0%}). "
                      f"Matched: {list(matches) or 'None'}",
        }
    return {
        "pass": True,
        "reason": f"{len(matches)}/{len(required_lower)} required skills matched ({ratio:.0%}). "
                  f"Matched: {list(matches)}",
    }


def _check_education(education: list, min_level: str | None = None) -> dict:
    """Basic education presence check."""
    if not education:
        return {"pass": True, "reason": "No education data to validate"}
    return {"pass": True, "reason": f"{len(education)} education entries found"}


def run(candidate: Candidate) -> dict:
    """Run all guardrail checks on a candidate."""
    start = time.time()
    execution = AgentExecution.objects.create(
        candidate=candidate,
        agent_type=AgentExecution.AgentType.GUARDRAIL,
        status=AgentExecution.Status.RUNNING,
        input_data={
            "experience_years": candidate.experience_years,
            "age": candidate.age,
            "skills_count": len(candidate.skills),
        },
    )

    try:
        job = candidate.job_position
        results = {
            "experience_check": _check_experience(
                candidate.experience_years, job.min_experience_years
            ),
            "age_check": _check_age(candidate.age),
            "skills_check": _check_required_skills(
                candidate.skills,
                job.requirements.split(",") if job.requirements else [],
            ),
            "education_check": _check_education(candidate.education),
        }

        all_passed = all(r["pass"] for r in results.values())
        results["overall"] = {
            "pass": all_passed,
            "checks_passed": sum(1 for r in results.values() if isinstance(r, dict) and r.get("pass")),
            "total_checks": len(results) - 1,
        }

        candidate.guardrail_results = results
        candidate.guardrail_passed = all_passed
        candidate.stage = Candidate.Stage.SCORED if all_passed else Candidate.Stage.SCREENED
        candidate.save()

        duration = time.time() - start
        execution.status = AgentExecution.Status.COMPLETED
        execution.output_data = results
        execution.duration_seconds = round(duration, 2)
        execution.save()

        logger.info(f"Guardrail agent completed for candidate {candidate.id}: passed={all_passed}")
        return results

    except Exception as e:
        duration = time.time() - start
        execution.status = AgentExecution.Status.FAILED
        execution.error_message = str(e)
        execution.duration_seconds = round(duration, 2)
        execution.save()
        logger.error(f"Guardrail agent failed for candidate {candidate.id}: {e}")
        raise
