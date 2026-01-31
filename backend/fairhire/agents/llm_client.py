"""Thin wrapper around OpenAI-compatible LLM APIs."""

import json
import logging
import re

from django.conf import settings
from openai import OpenAI

logger = logging.getLogger("fairhire.agents")


def get_client() -> OpenAI:
    return OpenAI(
        api_key=settings.OPENAI_API_KEY,
        base_url=settings.OPENAI_API_BASE,
    )


def chat(messages: list[dict], model: str | None = None, temperature: float = 0.2) -> str:
    """Send messages to the LLM and return the response content."""
    client = get_client()
    resp = client.chat.completions.create(
        model=model or settings.OPENAI_MODEL,
        messages=messages,
        temperature=temperature,
    )
    content = resp.choices[0].message.content or ""
    return content.strip()


def chat_json(messages: list[dict], model: str | None = None) -> dict:
    """Chat and parse JSON from the response."""
    raw = chat(messages, model=model, temperature=0.1)
    # Extract JSON from possible markdown wrapping
    match = re.search(r"\{.*\}", raw, flags=re.S)
    if not match:
        raise ValueError(f"No JSON found in LLM response: {raw[:300]}")
    return json.loads(match.group(0))
