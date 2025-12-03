"""Test script for sentence analysis - Genesis 1:30.

Usage:
    python scripts/test_analysis.py
"""

from __future__ import annotations

import json
import os
import re
from pathlib import Path
from typing import Optional, Union

# Try to import spaCy for lemmatization
try:
    import spacy
    nlp = spacy.load("en_core_web_sm")
    SPACY_AVAILABLE = True
except (ImportError, OSError):
    SPACY_AVAILABLE = False
    nlp = None

# Try to import Z.AI SDK
try:
    from zai import ZaiClient
    ZAI_SDK_AVAILABLE = True
except ImportError:
    ZAI_SDK_AVAILABLE = False
    import urllib.request
    import urllib.error

# Paths
SCRIPT_DIR = Path(__file__).parent
SENTENCE_DIR = SCRIPT_DIR.parent  # pipeline/sentence
PIPELINE_ROOT = SENTENCE_DIR.parent  # pipeline
SOURCE_DATA_DIR = PIPELINE_ROOT / "source-data"
VOCABULARY_OUTPUT_DIR = PIPELINE_ROOT / "vocabulary" / "output"
KOREAN_BIBLE_PATH = SOURCE_DATA_DIR / "Korean_Bible.json"

# Korean Bible cache
_korean_bible = None

# Load environment variables from vocabulary .env file
def load_env():
    """Load environment variables from .env file."""
    env_path = PIPELINE_ROOT / "vocabulary" / ".env"
    if env_path.exists():
        with open(env_path, "r") as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    key, value = line.split("=", 1)
                    os.environ.setdefault(key.strip(), value.strip())

load_env()

# API Configuration
API_BASE = os.environ.get("ZAI_API_BASE", "https://api.z.ai/api/coding/paas/v4")
API_KEY = os.environ.get("ZAI_API_KEY", "")
API_MODEL = os.environ.get("ZAI_MODEL", "glm-4.6")
API_TIMEOUT = 120

# Global SDK client
_zai_client = None


def get_zai_client():
    """Get or create ZAI SDK client."""
    global _zai_client
    if _zai_client is None and ZAI_SDK_AVAILABLE:
        _zai_client = ZaiClient(
            api_key=API_KEY,
            base_url=f"{API_BASE}/",
            timeout=float(API_TIMEOUT),
            max_retries=2
        )
    return _zai_client


def load_bible_data(version: str = "esv") -> dict:
    """Load Bible JSON data."""
    filename = f"{version.upper()}_Bible.json"
    filepath = SOURCE_DATA_DIR / filename
    with open(filepath, "r", encoding="utf-8") as f:
        return json.load(f)


def load_korean_bible() -> dict:
    """Load Korean Bible (개역개정) JSON data."""
    global _korean_bible
    if _korean_bible is None:
        with open(KOREAN_BIBLE_PATH, "r", encoding="utf-8") as f:
            _korean_bible = json.load(f)
    return _korean_bible


def get_korean_verse(book: str, chapter: int, verse: int) -> str:
    """Get Korean (개역개정) translation for a verse."""
    korean_bible = load_korean_bible()
    return korean_bible.get(book, {}).get(str(chapter), {}).get(str(verse), "")


def load_vocabulary(version: str = "esv") -> dict:
    """Load vocabulary data with word->id mapping."""
    filepath = VOCABULARY_OUTPUT_DIR / version / f"final_vocabulary_{version}.json"
    with open(filepath, "r", encoding="utf-8") as f:
        data = json.load(f)

    # Create word -> id mapping
    word_to_id = {}
    for word_data in data.get("words", []):
        word_to_id[word_data["word"].lower()] = word_data["id"]

    return word_to_id


def get_verse(bible_data: dict, book: str, chapter: int, verse: int) -> str:
    """Get a specific verse from Bible data."""
    return bible_data.get(book, {}).get(str(chapter), {}).get(str(verse), "")


def extract_json_from_response(response: str) -> dict | list | None:
    """Extract JSON from API response."""
    # Try to find JSON object or array
    match = re.search(r'[\[{][\s\S]*[\]}]', response)
    if match:
        try:
            return json.loads(match.group())
        except json.JSONDecodeError:
            pass
    return None


def create_analysis_prompt(verse_text: str, verse_ref: str) -> str:
    """Create prompt for sentence analysis."""
    return f"""Analyze this Bible verse and split it into SHORT, readable clauses for English learners.
For each clause, provide a Korean translation.

Verse: "{verse_text}"
Reference: {verse_ref}

Respond in JSON format ONLY (no markdown, no explanation):
{{
  "sentences": [
    {{
      "sequence_order": 1,
      "original_text": "short clause from the verse",
      "korean_translation": "한글 번역"
    }}
  ]
}}

Rules:
1. Split long sentences into SHORT clauses (max 10-15 words each)
2. Split at commas, semicolons, colons, "and", "but", "or", "that", "which", "who"
3. Each clause should be a complete thought that can be understood alone
4. Provide natural Korean translation for each clause
5. Keep sequence_order starting from 1
6. Cover ALL text from the verse - no omissions"""


def analyze_with_api(prompt: str) -> str | None:
    """Call Z.AI API with prompt."""
    client = get_zai_client()

    if client:
        # Use SDK
        try:
            response = client.chat.completions.create(
                model=API_MODEL,
                messages=[{"role": "user", "content": prompt}],
                temperature=0.3,
                extra_body={"thinking": {"type": "disabled"}}
            )
            return response.choices[0].message.content
        except Exception as e:
            print(f"SDK error: {e}")
            return None
    else:
        # Use urllib
        url = f"{API_BASE}/chat/completions"
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {API_KEY}"
        }
        data = {
            "model": API_MODEL,
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
            with urllib.request.urlopen(req, timeout=API_TIMEOUT) as response:
                result = json.loads(response.read().decode("utf-8"))
            return result.get("choices", [{}])[0].get("message", {}).get("content", "")
        except Exception as e:
            print(f"API error: {e}")
            return None


def find_word_indices(sentence: str, word_to_id: dict) -> list[int]:
    """Find vocabulary indices for words in a sentence using lemmatization."""
    indices = []
    seen = set()  # Avoid duplicates

    if SPACY_AVAILABLE and nlp:
        # Use spaCy for lemmatization
        doc = nlp(sentence)
        for token in doc:
            if token.is_alpha:
                lemma = token.lemma_.lower()
                if lemma in word_to_id and lemma not in seen:
                    indices.append(word_to_id[lemma])
                    seen.add(lemma)
    else:
        # Fallback: simple word extraction without lemmatization
        words = re.findall(r'[a-zA-Z]+', sentence.lower())
        for word in words:
            if word in word_to_id and word not in seen:
                indices.append(word_to_id[word])
                seen.add(word)

    return sorted(indices)


def analyze_verse(book: str, chapter: int, verse: int, version: str = "esv") -> dict:
    """Analyze a single verse and return structured data."""
    print(f"\n=== Analyzing {book} {chapter}:{verse} ({version.upper()}) ===\n")

    # Load data
    bible_data = load_bible_data(version)
    word_to_id = load_vocabulary(version)

    # Get verse text
    verse_text = get_verse(bible_data, book, chapter, verse)
    if not verse_text:
        raise ValueError(f"Verse not found: {book} {chapter}:{verse}")

    print(f"Original text: {verse_text}\n")

    # Create prompt and call API
    verse_ref = f"{book} {chapter}:{verse}"
    prompt = create_analysis_prompt(verse_text, verse_ref)

    print("Calling Z.AI API...")
    response = analyze_with_api(prompt)

    if not response:
        raise RuntimeError("API call failed")

    print(f"\nAPI Response:\n{response}\n")

    # Parse response
    parsed = extract_json_from_response(response)
    if not parsed:
        raise ValueError("Failed to parse JSON from response")

    # Build result
    sentences = []
    for sent in parsed.get("sentences", []):
        original = sent.get("original_text", "")
        word_indices = find_word_indices(original, word_to_id)

        sentences.append({
            "sequence_order": sent.get("sequence_order", 0),
            "original_text": original,
            "korean_translation": sent.get("korean_translation", ""),
            "word_indices": word_indices
        })

    # Get Korean (개역개정) translation
    korean_text = get_korean_verse(book, chapter, verse)

    result = {
        "verse_reference": verse_ref,
        "version": version.upper(),
        "original_text": verse_text,
        "korean_text": korean_text,
        "sentences": sentences
    }

    return result


def main():
    """Test analysis with Genesis 1:30."""
    if not API_KEY:
        print("ERROR: ZAI_API_KEY not found in environment")
        print("Please ensure pipeline/vocabulary/.env file exists with API credentials")
        return

    print(f"spaCy Available: {SPACY_AVAILABLE}")
    print(f"Z.AI SDK Available: {ZAI_SDK_AVAILABLE}")
    print(f"API Model: {API_MODEL}")

    # Analyze Genesis 1:30
    result = analyze_verse("Genesis", 1, 30, "esv")

    # Print result
    print("\n" + "=" * 60)
    print("ANALYSIS RESULT")
    print("=" * 60)
    print(json.dumps(result, indent=2, ensure_ascii=False))

    # Save to output folder
    output_dir = SENTENCE_DIR / "output" / "esv" / "Genesis"
    output_dir.mkdir(parents=True, exist_ok=True)

    output_file = output_dir / "Genesis_1_30.json"
    with open(output_file, "w", encoding="utf-8") as f:
        json.dump(result, f, indent=2, ensure_ascii=False)

    print(f"\nSaved to: {output_file}")


if __name__ == "__main__":
    main()
