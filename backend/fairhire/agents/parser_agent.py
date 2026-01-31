"""Resume Parser Agent — extracts structured data from resumes.

Maps to the notebook's json_txt_parser tool + resume parsing logic.
Enhanced with PDF/DOCX support and richer extraction.
"""

import json
import logging
import time

from fairhire.core.models import Candidate, AgentExecution
from .llm_client import chat_json

logger = logging.getLogger("fairhire.agents")

SYSTEM_PROMPT = """You are an expert resume parser. Extract structured information from the resume text.
Your response must be STRICT JSON matching this schema:
{
    "first_name": "string",
    "last_name": "string",
    "email": "string or empty",
    "phone": "string or empty",
    "age": null or integer,
    "experience_years": float (total years of professional experience),
    "current_title": "string",
    "skills": ["skill1", "skill2", ...],
    "education": [
        {
            "degree": "string",
            "institution": "string",
            "field": "string",
            "gpa": "string or null",
            "year": "string or null"
        }
    ],
    "work_experience": [
        {
            "title": "string",
            "company": "string",
            "duration": "string",
            "description": "string"
        }
    ],
    "certifications": ["cert1", ...],
    "languages": ["lang1", ...],
    "career_gaps": ["gap description if any"],
    "management_experience": boolean,
    "team_size_managed": integer or null,
    "notable_achievements": ["achievement1", ...],
    "summary": "2-3 sentence professional summary"
}

Rules:
- Extract ONLY what is present in the resume. Do NOT fabricate data.
- If age is not explicitly stated, set it to null.
- Estimate experience_years from work history dates if not explicit.
- Output STRICT JSON. No extra text.
"""


def run(candidate: Candidate) -> dict:
    """Parse a candidate's resume and store structured data."""
    start = time.time()
    execution = AgentExecution.objects.create(
        candidate=candidate,
        agent_type=AgentExecution.AgentType.PARSER,
        status=AgentExecution.Status.RUNNING,
        input_data={"resume_text_length": len(candidate.resume_text)},
    )

    try:
        resume_text = candidate.resume_text
        if not resume_text:
            raise ValueError("No resume text available for parsing")

        messages = [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": f"Parse the following resume:\n\n{resume_text}"},
        ]

        parsed = chat_json(messages)

        # Update candidate with parsed data
        candidate.first_name = parsed.get("first_name", "") or candidate.first_name
        candidate.last_name = parsed.get("last_name", "") or candidate.last_name
        candidate.email = parsed.get("email", "") or candidate.email
        candidate.phone = parsed.get("phone", "") or candidate.phone
        candidate.parsed_data = parsed
        candidate.skills = parsed.get("skills", [])
        candidate.experience_years = parsed.get("experience_years")
        candidate.education = parsed.get("education", [])
        candidate.age = parsed.get("age")
        candidate.stage = Candidate.Stage.PARSED
        candidate.save()

        duration = time.time() - start
        execution.status = AgentExecution.Status.COMPLETED
        execution.output_data = parsed
        execution.duration_seconds = round(duration, 2)
        execution.save()

        logger.info(f"Parser agent completed for candidate {candidate.id}")
        return parsed

    except Exception as e:
        duration = time.time() - start
        execution.status = AgentExecution.Status.FAILED
        execution.error_message = str(e)
        execution.duration_seconds = round(duration, 2)
        execution.save()
        logger.error(f"Parser agent failed for candidate {candidate.id}: {e}")
        raise
