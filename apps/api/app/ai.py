"""
OpenAI integration helper.

Provides a thin wrapper around the OpenAI API for all AI features.
Falls back to None when the API key is not configured.
"""

import logging

from app.config import settings

logger = logging.getLogger(__name__)

_client = None


def get_client():
    """Lazy-init OpenAI client. Returns None if not configured."""
    global _client
    if _client is not None:
        return _client
    if not settings.OPENAI_API_KEY:
        return None
    from openai import OpenAI
    _client = OpenAI(api_key=settings.OPENAI_API_KEY)
    return _client


def chat_completion(
    system_prompt: str,
    user_message: str,
    model: str = "gpt-4o-mini",
    max_tokens: int = 1024,
    temperature: float = 0.7,
) -> str | None:
    """
    Simple chat completion. Returns the assistant message text,
    or None if OpenAI is not configured.
    """
    client = get_client()
    if not client:
        return None
    try:
        response = client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_message},
            ],
            max_tokens=max_tokens,
            temperature=temperature,
        )
        return response.choices[0].message.content
    except Exception as e:
        logger.error("OpenAI API error: %s", e)
        return None
