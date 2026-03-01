"""
Claude AI Client — Wrapper for Anthropic SDK with JSON parsing and usage tracking.

Re-exports from services/claude_client.py and adds structured analysis helper.
"""

import os
import json
import logging
from typing import TypeVar, Optional

import anthropic

logger = logging.getLogger(__name__)

T = TypeVar("T")

MODEL = "claude-sonnet-4-6"

_client: Optional[anthropic.Anthropic] = None


def get_client() -> anthropic.Anthropic:
    global _client
    if _client is None:
        api_key = os.getenv("ANTHROPIC_API_KEY")
        if not api_key:
            raise ValueError("ANTHROPIC_API_KEY not set")
        _client = anthropic.Anthropic(api_key=api_key)
    return _client


def analyze_json(
    system_prompt: str,
    user_prompt: str,
    max_tokens: int = 1024,
) -> tuple[dict, int]:
    """
    Call Claude with Hebrew system prompt, get JSON response.

    Returns:
        (parsed_json, tokens_used)
    """
    full_system = f"""{system_prompt}

חשוב מאוד:
- דבר תמיד בעברית
- טון חברותי וחם — כמו חבר חכם
- היה ספציפי עם מספרים ועובדות
- תמיד סיים עם פעולה אחת ברורה
- החזר JSON בלבד — ללא טקסט לפני או אחרי"""

    client = get_client()
    response = client.messages.create(
        model=MODEL,
        max_tokens=max_tokens,
        system=full_system,
        messages=[{"role": "user", "content": user_prompt}],
    )

    tokens_used = response.usage.input_tokens + response.usage.output_tokens

    text = ""
    if response.content and response.content[0].type == "text":
        text = response.content[0].text

    # Clean and parse JSON
    clean = text.replace("```json", "").replace("```", "").strip()
    try:
        return json.loads(clean), tokens_used
    except json.JSONDecodeError:
        import re
        match = re.search(r"\{[\s\S]*\}", clean)
        if match:
            return json.loads(match.group(0)), tokens_used
        # Try array
        match = re.search(r"\[[\s\S]*\]", clean)
        if match:
            return json.loads(match.group(0)), tokens_used
        raise ValueError(f"Claude returned invalid JSON: {clean[:200]}")


def track_usage(sb_client, user_id: str, agent_name: str, tokens: int):
    """Log AI token usage to ai_usage table."""
    try:
        if sb_client:
            sb_client.table("ai_usage").insert({
                "user_id": user_id,
                "agent_name": agent_name,
                "tokens": tokens,
            }).execute()
    except Exception as e:
        logger.error(f"Usage tracking failed: {e}")
