"""LLM client for vocabulary definition generation.

Supports multiple backends: droid CLI, claude CLI, and Z.AI API.
"""

from __future__ import annotations

import json
import os
import re
import subprocess
import urllib.error
import urllib.request
from dataclasses import dataclass
from pathlib import Path

# Optional SDK import
try:
    from zai import ZaiClient
    ZAI_SDK_AVAILABLE = True
except ImportError:
    ZAI_SDK_AVAILABLE = False


def load_env() -> None:
    """Load environment variables from .env file."""
    env_path = Path(__file__).parent.parent / ".env"
    if env_path.exists():
        with open(env_path, "r") as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    key, value = line.split("=", 1)
                    os.environ.setdefault(key.strip(), value.strip())


load_env()


@dataclass
class LLMConfig:
    """LLM client configuration."""
    use_api: bool = False
    cli_tool: str = "droid"
    model: str = "glm-4.6"
    api_base: str = os.environ.get("ZAI_API_BASE", "https://api.z.ai/api/coding/paas/v4")
    api_key: str = os.environ.get("ZAI_API_KEY", "")
    api_model: str = os.environ.get("ZAI_MODEL", "glm-4.6")
    cli_timeout: int = 300
    api_timeout: int = 120


# Global config and client
_config = LLMConfig()
_zai_client = None


def configure(
    use_api: bool = False,
    cli_tool: str = "droid",
    model: str = "glm-4.6"
) -> None:
    """Configure the LLM client."""
    global _config
    _config = LLMConfig(use_api=use_api, cli_tool=cli_tool, model=model)


def get_zai_client():
    """Get or create ZAI SDK client."""
    global _zai_client
    if _zai_client is None and ZAI_SDK_AVAILABLE:
        _zai_client = ZaiClient(
            api_key=_config.api_key,
            base_url=f"{_config.api_base}/",
            timeout=float(_config.api_timeout),
            max_retries=2
        )
    return _zai_client


def extract_json_from_response(response: str) -> list:
    """Extract JSON array from LLM response."""
    match = re.search(r'\[[\s\S]*\]', response)
    if match:
        try:
            return json.loads(match.group())
        except json.JSONDecodeError:
            pass
    return []


def call_cli(prompt: str) -> str | None:
    """Call CLI tool (droid or claude) with prompt."""
    if _config.cli_tool == "droid":
        cmd = ["droid", "exec", "-o", "text"]
    else:
        cmd = [_config.cli_tool, "--model", _config.model, "--print"]

    try:
        result = subprocess.run(
            cmd,
            input=prompt,
            capture_output=True,
            text=True,
            timeout=_config.cli_timeout
        )
        if result.returncode == 0:
            return result.stdout
    except subprocess.TimeoutExpired:
        pass
    except Exception:
        pass
    return None


def call_api(prompt: str) -> str | None:
    """Call Z.AI API with prompt."""
    url = f"{_config.api_base}/chat/completions"
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {_config.api_key}"
    }
    data = {
        "model": _config.api_model,
        "messages": [{"role": "user", "content": prompt}],
        "temperature": 0.3
    }

    try:
        req = urllib.request.Request(
            url,
            data=json.dumps(data).encode("utf-8"),
            headers=headers,
            method="POST"
        )
        with urllib.request.urlopen(req, timeout=_config.api_timeout) as response:
            result = json.loads(response.read().decode("utf-8"))
        return result.get("choices", [{}])[0].get("message", {}).get("content", "")
    except (urllib.error.HTTPError, urllib.error.URLError, TimeoutError):
        pass
    except Exception:
        pass
    return None


def call_sdk(prompt: str) -> str | None:
    """Call Z.AI SDK with prompt."""
    client = get_zai_client()
    if client is None:
        return call_api(prompt)

    try:
        response = client.chat.completions.create(
            model=_config.api_model,
            messages=[{"role": "user", "content": prompt}],
            temperature=0.3,
            extra_body={"thinking": {"type": "disabled"}}
        )
        if response.choices:
            return response.choices[0].message.content or ""
    except Exception:
        pass
    return None


def generate(prompt: str) -> str | None:
    """Generate response using configured backend."""
    if _config.use_api:
        if ZAI_SDK_AVAILABLE:
            return call_sdk(prompt)
        return call_api(prompt)
    return call_cli(prompt)


def generate_definitions(words: list[str]) -> list[dict]:
    """Generate definitions for a batch of words.

    Returns list of definition dicts with word, ipa_pronunciation,
    korean_pronunciation, definition_korean.
    """
    prompt = f"""You are a Bible vocabulary assistant. Generate pronunciation and Korean definition for each English word.

Words: {", ".join(words)}

Respond in JSON array format ONLY (no explanation, no markdown):
[
  {{
    "word": "word",
    "ipa_pronunciation": "[IPA]",
    "korean_pronunciation": "한글 발음",
    "definition_korean": "한국어 뜻 (간결하게)"
  }}
]"""

    response = generate(prompt)
    if response:
        return extract_json_from_response(response)
    return []
