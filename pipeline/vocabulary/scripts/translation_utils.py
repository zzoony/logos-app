"""Common translation utilities for sentence translation scripts."""

import json
import re


def create_translation_prompt(sentences: list[tuple[str, str, str]]) -> str:
    """Create prompt for Claude to translate sentences.

    Args:
        sentences: List of (id, text, ref) tuples
    """
    verses_text = "\n".join([
        f'{i+1}. "{text}" ({ref})'
        for i, (_, text, ref) in enumerate(sentences)
    ])

    return f"""Translate these Bible verses to Korean. Return JSON array ONLY (no markdown, no explanation):

Verses:
{verses_text}

Response format:
[
  {{"id": 1, "korean": "한글 번역"}},
  ...
]"""


def extract_json_from_response(response: str) -> list:
    """Extract JSON array from Claude response."""
    match = re.search(r'\[[\s\S]*\]', response)
    if match:
        try:
            return json.loads(match.group())
        except json.JSONDecodeError:
            pass
    return []
