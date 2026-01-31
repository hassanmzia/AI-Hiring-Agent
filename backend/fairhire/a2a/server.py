"""Agent-to-Agent (A2A) Protocol Server.

Implements the A2A protocol for inter-agent communication.
Agents can discover each other's capabilities and delegate tasks.

Each hiring agent (parser, guardrail, scorer, summarizer, bias_auditor)
is exposed as an A2A-compatible agent that can be invoked by other agents.
"""

import json
import logging
import uuid
from typing import Any

from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods

from fairhire.core.models import Candidate

logger = logging.getLogger("fairhire.a2a")

# ─── Agent Cards (A2A discovery) ──────────────────────────────
AGENT_CARDS = {
    "resume-parser": {
        "id": "fairhire-resume-parser",
        "name": "Resume Parser Agent",
        "description": "Parses resumes (PDF, DOCX, TXT) into structured candidate data",
        "version": "1.0.0",
        "capabilities": ["parse_resume", "extract_skills", "extract_experience"],
        "inputModes": ["text"],
        "outputModes": ["application/json"],
    },
    "guardrail-checker": {
        "id": "fairhire-guardrail-checker",
        "name": "Guardrail Checker Agent",
        "description": "Validates candidates against mandatory hiring policies (age, experience, skills)",
        "version": "1.0.0",
        "capabilities": ["check_experience", "check_age", "check_skills", "check_education"],
        "inputModes": ["application/json"],
        "outputModes": ["application/json"],
    },
    "scorer": {
        "id": "fairhire-scorer",
        "name": "Scoring Agent",
        "description": "LLM-based rubric scorer with weighted components and confidence levels",
        "version": "1.0.0",
        "capabilities": ["score_candidate", "rubric_evaluation"],
        "inputModes": ["text", "application/json"],
        "outputModes": ["application/json"],
    },
    "summarizer": {
        "id": "fairhire-summarizer",
        "name": "Summary Agent",
        "description": "Generates evaluation summaries with pros, cons, and recommendations",
        "version": "1.0.0",
        "capabilities": ["generate_summary", "recommend_action"],
        "inputModes": ["application/json"],
        "outputModes": ["application/json"],
    },
    "bias-auditor": {
        "id": "fairhire-bias-auditor",
        "name": "Bias Auditor Agent",
        "description": "Runs Responsible AI probes: name swaps, proxy flips, PII redaction, injection testing",
        "version": "1.0.0",
        "capabilities": ["name_swap_probe", "proxy_flip_probe", "adversarial_probe", "pii_scan", "pii_redact"],
        "inputModes": ["text", "application/json"],
        "outputModes": ["application/json"],
    },
    "orchestrator": {
        "id": "fairhire-orchestrator",
        "name": "Pipeline Orchestrator Agent",
        "description": "Coordinates the full multi-agent evaluation pipeline",
        "version": "1.0.0",
        "capabilities": ["run_pipeline", "bulk_evaluate"],
        "inputModes": ["application/json"],
        "outputModes": ["application/json"],
    },
}


def _dispatch_task(agent_id: str, task_data: dict) -> dict:
    """Dispatch a task to the appropriate agent."""
    from fairhire.agents import (
        parser_agent, guardrail_agent, scorer_agent,
        summary_agent, bias_auditor_agent,
    )
    from fairhire.agents.orchestrator import run_full_pipeline

    candidate_id = task_data.get("candidate_id")
    if not candidate_id:
        raise ValueError("candidate_id is required")

    candidate = Candidate.objects.get(id=candidate_id)

    agent_map = {
        "fairhire-resume-parser": parser_agent.run,
        "fairhire-guardrail-checker": guardrail_agent.run,
        "fairhire-scorer": scorer_agent.run,
        "fairhire-summarizer": summary_agent.run,
        "fairhire-bias-auditor": bias_auditor_agent.run,
    }

    if agent_id == "fairhire-orchestrator":
        return run_full_pipeline(candidate, run_bias_audit=task_data.get("run_bias_audit", True))

    agent_fn = agent_map.get(agent_id)
    if not agent_fn:
        raise ValueError(f"Unknown agent: {agent_id}")

    return agent_fn(candidate)


@csrf_exempt
@require_http_methods(["GET"])
def agent_card(request, agent_key=None):
    """A2A Agent Card discovery endpoint."""
    if agent_key:
        card = AGENT_CARDS.get(agent_key)
        if not card:
            return JsonResponse({"error": f"Agent not found: {agent_key}"}, status=404)
        return JsonResponse(card)
    return JsonResponse({"agents": list(AGENT_CARDS.values())})


@csrf_exempt
@require_http_methods(["POST"])
def send_task(request):
    """A2A send task endpoint — delegates work to a specific agent."""
    try:
        body = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({"error": "Invalid JSON"}, status=400)

    task_id = str(uuid.uuid4())
    agent_id = body.get("agent_id", "")
    task_data = body.get("task", {})

    try:
        result = _dispatch_task(agent_id, task_data)
        return JsonResponse({
            "id": task_id,
            "agent_id": agent_id,
            "status": "completed",
            "result": result,
        }, json_dumps_params={"default": str})
    except Candidate.DoesNotExist:
        return JsonResponse({
            "id": task_id, "agent_id": agent_id,
            "status": "failed", "error": "Candidate not found",
        }, status=404)
    except Exception as e:
        logger.error(f"A2A task error ({agent_id}): {e}")
        return JsonResponse({
            "id": task_id, "agent_id": agent_id,
            "status": "failed", "error": str(e),
        }, status=500)


@csrf_exempt
@require_http_methods(["POST"])
def send_task_async(request):
    """A2A async task — queues work via Celery."""
    try:
        body = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({"error": "Invalid JSON"}, status=400)

    from fairhire.agents.tasks import run_pipeline_task, run_single_agent_task

    task_id = str(uuid.uuid4())
    agent_id = body.get("agent_id", "")
    task_data = body.get("task", {})
    candidate_id = task_data.get("candidate_id")

    if not candidate_id:
        return JsonResponse({"error": "candidate_id required"}, status=400)

    agent_type_map = {
        "fairhire-resume-parser": "parser",
        "fairhire-guardrail-checker": "guardrail",
        "fairhire-scorer": "scorer",
        "fairhire-summarizer": "summarizer",
        "fairhire-bias-auditor": "bias_auditor",
    }

    if agent_id == "fairhire-orchestrator":
        celery_task = run_pipeline_task.delay(candidate_id, run_bias_audit=task_data.get("run_bias_audit", True))
    elif agent_id in agent_type_map:
        celery_task = run_single_agent_task.delay(candidate_id, agent_type_map[agent_id])
    else:
        return JsonResponse({"error": f"Unknown agent: {agent_id}"}, status=404)

    return JsonResponse({
        "id": task_id,
        "agent_id": agent_id,
        "status": "queued",
        "celery_task_id": str(celery_task.id),
    }, status=202)
