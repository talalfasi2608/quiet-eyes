"""
Claude AI Client for Quiet Eyes.

Wraps the Anthropic SDK and provides simple chat() and analyze() functions
used across all AI-powered features.
"""

import os
import logging
from typing import Optional

import anthropic

logger = logging.getLogger(__name__)

_client: Optional[anthropic.Anthropic] = None

MODEL = "claude-sonnet-4-6"


def get_client() -> anthropic.Anthropic:
    """
    Get or create the singleton Anthropic client.

    Uses ANTHROPIC_API_KEY from environment.
    """
    global _client
    if _client is None:
        api_key = os.getenv("ANTHROPIC_API_KEY")
        if not api_key:
            raise ValueError("ANTHROPIC_API_KEY not set")
        _client = anthropic.Anthropic(api_key=api_key)
    return _client


def chat(
    messages: list[dict],
    system: str = "",
    max_tokens: int = 1000,
    temperature: float = 0.7,
) -> str:
    """
    Send a chat conversation to Claude and return the text response.

    Args:
        messages: List of {"role": "user"|"assistant", "content": "..."}
        system: Optional system prompt (separate from messages in Claude API)
        max_tokens: Maximum tokens in the response
        temperature: Sampling temperature (0.0 - 1.0)

    Returns:
        The assistant's text response.
    """
    client = get_client()
    kwargs = {
        "model": MODEL,
        "max_tokens": max_tokens,
        "messages": messages,
        "temperature": temperature,
    }
    if system:
        kwargs["system"] = system

    response = client.messages.create(**kwargs)
    if not response.content:
        logger.warning(f"Claude returned empty content. stop_reason={response.stop_reason}")
        return ""
    return response.content[0].text


def analyze(
    prompt: str,
    system: str = "",
    max_tokens: int = 2000,
    temperature: float = 0.7,
) -> str:
    """
    Send a single prompt to Claude and return the text response.

    Convenience wrapper around chat() for one-shot analysis tasks.

    Args:
        prompt: The user prompt to analyze
        system: Optional system prompt
        max_tokens: Maximum tokens in the response
        temperature: Sampling temperature

    Returns:
        The assistant's text response.
    """
    return chat(
        messages=[{"role": "user", "content": prompt}],
        system=system,
        max_tokens=max_tokens,
        temperature=temperature,
    )
