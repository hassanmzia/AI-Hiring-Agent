"""Orchestrator Agent — coordinates the multi-agent pipeline.

This is the master agent that runs the full evaluation pipeline:
1. Resume Parsing
2. PII Redaction
3. Guardrail Checks
4. Scoring
5. Summary
6. Bias Audit (optional)

Maps to the notebook's CodeAgent with managed tools.
"""

import logging
import time

from fairhire.core.models import Candidate, AgentExecution, ActivityLog
from . import parser_agent, guardrail_agent, scorer_agent, summary_agent, bias_auditor_agent

logger = logging.getLogger("fairhire.agents")


def run_full_pipeline(candidate: Candidate, run_bias_audit: bool = True) -> dict:
    """Execute the complete multi-agent evaluation pipeline."""
    start = time.time()
    execution = AgentExecution.objects.create(
        candidate=candidate,
        agent_type=AgentExecution.AgentType.ORCHESTRATOR,
        status=AgentExecution.Status.RUNNING,
    )

    pipeline_results = {
        "candidate_id": str(candidate.id),
        "steps": {},
        "errors": [],
    }

    try:
        # Step 1: Parse Resume
        logger.info(f"Pipeline step 1/5: Parsing resume for candidate {candidate.id}")
        candidate.stage = Candidate.Stage.PARSING
        candidate.save(update_fields=["stage"])
        try:
            parsed = parser_agent.run(candidate)
            pipeline_results["steps"]["parsing"] = {"status": "completed", "data": parsed}
            _log_activity(candidate, "agent_completed", "Resume parsed successfully")
        except Exception as e:
            pipeline_results["steps"]["parsing"] = {"status": "failed", "error": str(e)}
            pipeline_results["errors"].append(f"Parser: {e}")
            logger.error(f"Pipeline parsing failed: {e}")

        # Refresh from DB
        candidate.refresh_from_db()

        # Step 2: PII Redaction (pre-processing for scoring)
        logger.info(f"Pipeline step 2/5: Redacting PII for candidate {candidate.id}")
        pii = bias_auditor_agent.pii_scan(candidate.resume_text)
        candidate.resume_redacted = bias_auditor_agent.prepare_for_scoring(candidate.resume_text)
        candidate.save(update_fields=["resume_redacted"])
        pipeline_results["steps"]["pii_redaction"] = {"status": "completed", "pii_count": pii["count"]}

        # Step 3: Guardrail Checks
        logger.info(f"Pipeline step 3/5: Running guardrails for candidate {candidate.id}")
        candidate.stage = Candidate.Stage.GUARDRAIL_CHECK
        candidate.save(update_fields=["stage"])
        try:
            guardrails = guardrail_agent.run(candidate)
            pipeline_results["steps"]["guardrails"] = {"status": "completed", "data": guardrails}
            _log_activity(candidate, "agent_completed", f"Guardrails: {'PASSED' if candidate.guardrail_passed else 'FAILED'}")
        except Exception as e:
            pipeline_results["steps"]["guardrails"] = {"status": "failed", "error": str(e)}
            pipeline_results["errors"].append(f"Guardrail: {e}")

        candidate.refresh_from_db()

        # Step 4: Scoring
        logger.info(f"Pipeline step 4/5: Scoring candidate {candidate.id}")
        candidate.stage = Candidate.Stage.SCORING
        candidate.save(update_fields=["stage"])
        try:
            scores = scorer_agent.run(candidate)
            pipeline_results["steps"]["scoring"] = {"status": "completed", "data": scores}
            _log_activity(candidate, "agent_completed", f"Score: {scores.get('score', 'N/A')}")
        except Exception as e:
            pipeline_results["steps"]["scoring"] = {"status": "failed", "error": str(e)}
            pipeline_results["errors"].append(f"Scorer: {e}")

        candidate.refresh_from_db()

        # Step 5: Summary
        logger.info(f"Pipeline step 5/5: Summarizing candidate {candidate.id}")
        candidate.stage = Candidate.Stage.SUMMARIZING
        candidate.save(update_fields=["stage"])
        try:
            summary = summary_agent.run(candidate)
            pipeline_results["steps"]["summary"] = {"status": "completed", "data": summary}
            _log_activity(candidate, "agent_completed", f"Summary: {summary.get('suggested_action', 'N/A')}")
        except Exception as e:
            pipeline_results["steps"]["summary"] = {"status": "failed", "error": str(e)}
            pipeline_results["errors"].append(f"Summary: {e}")

        candidate.refresh_from_db()

        # Step 6: Bias Audit (optional)
        if run_bias_audit:
            logger.info(f"Pipeline bonus step: Bias audit for candidate {candidate.id}")
            candidate.stage = Candidate.Stage.BIAS_AUDIT
            candidate.save(update_fields=["stage"])
            try:
                audit = bias_auditor_agent.run(candidate)
                pipeline_results["steps"]["bias_audit"] = {"status": "completed", "data": audit}
                flags = audit.get("flagged_probes", 0)
                _log_activity(
                    candidate,
                    "bias_flag" if flags else "agent_completed",
                    f"Bias audit: {flags} flags raised",
                )
            except Exception as e:
                pipeline_results["steps"]["bias_audit"] = {"status": "failed", "error": str(e)}
                pipeline_results["errors"].append(f"Bias Audit: {e}")

        candidate.refresh_from_db()

        # Final stage
        if not pipeline_results["errors"]:
            candidate.stage = Candidate.Stage.REVIEWED
        candidate.save(update_fields=["stage"])

        duration = time.time() - start
        pipeline_results["total_duration_seconds"] = round(duration, 2)
        pipeline_results["final_stage"] = candidate.stage

        execution.status = AgentExecution.Status.COMPLETED
        execution.output_data = pipeline_results
        execution.duration_seconds = round(duration, 2)
        execution.save()

        logger.info(f"Pipeline completed for candidate {candidate.id} in {duration:.1f}s")
        return pipeline_results

    except Exception as e:
        duration = time.time() - start
        execution.status = AgentExecution.Status.FAILED
        execution.error_message = str(e)
        execution.duration_seconds = round(duration, 2)
        execution.save()
        logger.error(f"Pipeline failed for candidate {candidate.id}: {e}")
        raise


def _log_activity(candidate: Candidate, event_type: str, message: str):
    """Create an activity log entry."""
    event_map = {
        "agent_completed": ActivityLog.EventType.AGENT_COMPLETED,
        "bias_flag": ActivityLog.EventType.BIAS_FLAG,
        "stage_changed": ActivityLog.EventType.STAGE_CHANGED,
    }
    ActivityLog.objects.create(
        event_type=event_map.get(event_type, ActivityLog.EventType.AGENT_COMPLETED),
        candidate=candidate,
        job_position=candidate.job_position,
        message=message,
    )
