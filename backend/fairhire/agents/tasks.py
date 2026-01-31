"""Celery tasks for async agent execution."""

import logging

from celery import shared_task

from fairhire.core.models import Candidate

logger = logging.getLogger("fairhire.agents")


@shared_task(bind=True, queue="agents", max_retries=2)
def run_pipeline_task(self, candidate_id: str, run_bias_audit: bool = True):
    """Run the full evaluation pipeline asynchronously."""
    from .orchestrator import run_full_pipeline

    try:
        candidate = Candidate.objects.get(id=candidate_id)
        result = run_full_pipeline(candidate, run_bias_audit=run_bias_audit)
        return result
    except Candidate.DoesNotExist:
        logger.error(f"Candidate {candidate_id} not found")
        raise
    except ValueError as e:
        # Validation errors (e.g., no resume text) should not be retried
        logger.error(f"Pipeline validation error for {candidate_id}: {e}")
        raise
    except Exception as e:
        logger.error(f"Pipeline task failed for {candidate_id}: {e}")
        raise self.retry(exc=e, countdown=30)


@shared_task(bind=True, queue="agents")
def run_single_agent_task(self, candidate_id: str, agent_type: str):
    """Run a single agent on a candidate."""
    from . import parser_agent, guardrail_agent, scorer_agent, summary_agent, bias_auditor_agent

    agents = {
        "parser": parser_agent,
        "guardrail": guardrail_agent,
        "scorer": scorer_agent,
        "summarizer": summary_agent,
        "bias_auditor": bias_auditor_agent,
    }

    try:
        candidate = Candidate.objects.get(id=candidate_id)
        agent = agents.get(agent_type)
        if not agent:
            raise ValueError(f"Unknown agent type: {agent_type}")
        return agent.run(candidate)
    except Candidate.DoesNotExist:
        logger.error(f"Candidate {candidate_id} not found")
        raise
    except Exception as e:
        logger.error(f"Agent {agent_type} failed for {candidate_id}: {e}")
        raise


@shared_task(queue="default")
def bulk_evaluate_candidates(job_position_id: str, run_bias_audit: bool = True):
    """Kick off pipeline for all NEW candidates in a job position."""
    candidates = Candidate.objects.filter(
        job_position_id=job_position_id,
        stage=Candidate.Stage.NEW,
    )
    task_ids = []
    for c in candidates:
        t = run_pipeline_task.delay(str(c.id), run_bias_audit=run_bias_audit)
        task_ids.append(str(t.id))
    return {"queued": len(task_ids), "task_ids": task_ids}
