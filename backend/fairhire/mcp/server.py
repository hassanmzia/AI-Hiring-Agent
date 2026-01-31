"""Model Context Protocol (MCP) Server.

Exposes FAIRHire tools via MCP so external LLM agents can invoke them.
Implements the MCP JSON-RPC transport over HTTP.
"""

import json
import logging
import uuid
from typing import Any

from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods

from fairhire.core.models import Candidate, JobPosition, AgentExecution
from fairhire.agents import (
    parser_agent, guardrail_agent, scorer_agent,
    summary_agent, bias_auditor_agent,
)
from fairhire.agents.orchestrator import run_full_pipeline

logger = logging.getLogger("fairhire.mcp")

# ─── Tool Definitions (MCP format) ────────────────────────────
MCP_TOOLS = [
    {
        "name": "parse_resume",
        "description": "Parse a candidate's resume and extract structured data including skills, experience, education.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "candidate_id": {"type": "string", "description": "UUID of the candidate to parse"},
            },
            "required": ["candidate_id"],
        },
    },
    {
        "name": "check_guardrails",
        "description": "Run guardrail checks (age, experience, skills) on a candidate against job requirements.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "candidate_id": {"type": "string", "description": "UUID of the candidate"},
            },
            "required": ["candidate_id"],
        },
    },
    {
        "name": "score_candidate",
        "description": "Score a candidate using LLM-based rubric evaluation with weighted components and confidence.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "candidate_id": {"type": "string", "description": "UUID of the candidate"},
            },
            "required": ["candidate_id"],
        },
    },
    {
        "name": "generate_summary",
        "description": "Generate evaluation summary with pros, cons, suggested action, and detailed reasoning.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "candidate_id": {"type": "string", "description": "UUID of the candidate"},
            },
            "required": ["candidate_id"],
        },
    },
    {
        "name": "run_bias_audit",
        "description": "Run Responsible AI bias probes: name swaps, proxy flips, adversarial injection tests.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "candidate_id": {"type": "string", "description": "UUID of the candidate"},
            },
            "required": ["candidate_id"],
        },
    },
    {
        "name": "run_full_pipeline",
        "description": "Execute the complete multi-agent hiring evaluation pipeline for a candidate.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "candidate_id": {"type": "string", "description": "UUID of the candidate"},
                "run_bias_audit": {"type": "boolean", "default": True},
            },
            "required": ["candidate_id"],
        },
    },
    {
        "name": "list_candidates",
        "description": "List candidates for a job position with their current evaluation status.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "job_position_id": {"type": "string", "description": "UUID of the job position"},
                "stage": {"type": "string", "description": "Filter by pipeline stage"},
            },
            "required": ["job_position_id"],
        },
    },
    {
        "name": "get_candidate_report",
        "description": "Get the full evaluation report for a candidate including all agent results.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "candidate_id": {"type": "string", "description": "UUID of the candidate"},
            },
            "required": ["candidate_id"],
        },
    },
]


def _execute_tool(name: str, arguments: dict) -> Any:
    """Execute an MCP tool and return results."""
    if name == "parse_resume":
        candidate = Candidate.objects.get(id=arguments["candidate_id"])
        return parser_agent.run(candidate)

    elif name == "check_guardrails":
        candidate = Candidate.objects.get(id=arguments["candidate_id"])
        return guardrail_agent.run(candidate)

    elif name == "score_candidate":
        candidate = Candidate.objects.get(id=arguments["candidate_id"])
        return scorer_agent.run(candidate)

    elif name == "generate_summary":
        candidate = Candidate.objects.get(id=arguments["candidate_id"])
        return summary_agent.run(candidate)

    elif name == "run_bias_audit":
        candidate = Candidate.objects.get(id=arguments["candidate_id"])
        return bias_auditor_agent.run(candidate)

    elif name == "run_full_pipeline":
        candidate = Candidate.objects.get(id=arguments["candidate_id"])
        return run_full_pipeline(candidate, run_bias_audit=arguments.get("run_bias_audit", True))

    elif name == "list_candidates":
        qs = Candidate.objects.filter(job_position_id=arguments["job_position_id"])
        if "stage" in arguments:
            qs = qs.filter(stage=arguments["stage"])
        return [
            {
                "id": str(c.id),
                "name": c.full_name,
                "stage": c.stage,
                "score": c.overall_score,
                "action": c.suggested_action,
            }
            for c in qs[:50]
        ]

    elif name == "get_candidate_report":
        c = Candidate.objects.get(id=arguments["candidate_id"])
        return {
            "id": str(c.id),
            "name": c.full_name,
            "stage": c.stage,
            "parsed_data": c.parsed_data,
            "guardrail_results": c.guardrail_results,
            "scoring_results": c.scoring_results,
            "summary_results": c.summary_results,
            "bias_audit_results": c.bias_audit_results,
            "overall_score": c.overall_score,
            "suggested_action": c.suggested_action,
        }

    raise ValueError(f"Unknown tool: {name}")


@csrf_exempt
@require_http_methods(["POST", "GET"])
def mcp_endpoint(request):
    """MCP JSON-RPC endpoint."""
    if request.method == "GET":
        # Return server capabilities
        return JsonResponse({
            "jsonrpc": "2.0",
            "result": {
                "name": "fairhire-mcp-server",
                "version": "1.0.0",
                "description": "FAIRHire AI Hiring Agent — Multi-agent evaluation with Responsible AI",
                "capabilities": {
                    "tools": True,
                    "resources": True,
                },
            },
        })

    try:
        body = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({"jsonrpc": "2.0", "error": {"code": -32700, "message": "Parse error"}}, status=400)

    method = body.get("method", "")
    req_id = body.get("id", str(uuid.uuid4()))
    params = body.get("params", {})

    if method == "initialize":
        return JsonResponse({
            "jsonrpc": "2.0",
            "id": req_id,
            "result": {
                "protocolVersion": "2024-11-05",
                "serverInfo": {"name": "fairhire-mcp-server", "version": "1.0.0"},
                "capabilities": {"tools": {"listChanged": False}},
            },
        })

    elif method == "tools/list":
        return JsonResponse({
            "jsonrpc": "2.0",
            "id": req_id,
            "result": {"tools": MCP_TOOLS},
        })

    elif method == "tools/call":
        tool_name = params.get("name", "")
        arguments = params.get("arguments", {})
        try:
            result = _execute_tool(tool_name, arguments)
            return JsonResponse({
                "jsonrpc": "2.0",
                "id": req_id,
                "result": {
                    "content": [{"type": "text", "text": json.dumps(result, default=str)}],
                    "isError": False,
                },
            })
        except Exception as e:
            logger.error(f"MCP tool error ({tool_name}): {e}")
            return JsonResponse({
                "jsonrpc": "2.0",
                "id": req_id,
                "result": {
                    "content": [{"type": "text", "text": str(e)}],
                    "isError": True,
                },
            })

    elif method == "resources/list":
        return JsonResponse({
            "jsonrpc": "2.0",
            "id": req_id,
            "result": {
                "resources": [
                    {
                        "uri": "fairhire://jobs",
                        "name": "Job Positions",
                        "description": "All job positions in the system",
                        "mimeType": "application/json",
                    },
                    {
                        "uri": "fairhire://dashboard",
                        "name": "Dashboard Stats",
                        "description": "Hiring pipeline statistics",
                        "mimeType": "application/json",
                    },
                ],
            },
        })

    elif method == "resources/read":
        uri = params.get("uri", "")
        if uri == "fairhire://jobs":
            jobs = list(JobPosition.objects.values("id", "title", "status", "department__name"))
            return JsonResponse({
                "jsonrpc": "2.0", "id": req_id,
                "result": {"contents": [{"uri": uri, "mimeType": "application/json", "text": json.dumps(jobs, default=str)}]},
            })
        elif uri == "fairhire://dashboard":
            from fairhire.api.views import dashboard_stats as _ds
            # Return basic stats
            stats = {
                "total_jobs": JobPosition.objects.count(),
                "total_candidates": Candidate.objects.count(),
            }
            return JsonResponse({
                "jsonrpc": "2.0", "id": req_id,
                "result": {"contents": [{"uri": uri, "mimeType": "application/json", "text": json.dumps(stats)}]},
            })

    return JsonResponse({
        "jsonrpc": "2.0",
        "id": req_id,
        "error": {"code": -32601, "message": f"Method not found: {method}"},
    }, status=404)
