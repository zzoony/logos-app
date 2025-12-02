"""Pipeline configuration with version support."""

import json
import os
from pathlib import Path

# Base paths
SCRIPTS_DIR = Path(__file__).parent
PIPELINE_DIR = SCRIPTS_DIR.parent
CONFIGS_DIR = PIPELINE_DIR / "configs"
SOURCE_DATA_DIR = PIPELINE_DIR / "source-data"
DATA_DIR = PIPELINE_DIR / "data"
OUTPUT_DIR = PIPELINE_DIR / "output"

# Get version from environment variable (default: niv)
VERSION = os.environ.get("BIBLE_VERSION", "niv")


def load_version_config(version: str) -> dict:
    """Load version-specific configuration."""
    config_path = CONFIGS_DIR / f"{version}.json"
    if not config_path.exists():
        raise FileNotFoundError(f"Config file not found: {config_path}")

    with open(config_path, "r", encoding="utf-8") as f:
        return json.load(f)


# Load version config
_config = load_version_config(VERSION)

# Version info
VERSION_NAME = _config.get("name", VERSION)
LANGUAGE = _config.get("language", "en")

# Version-specific data directory
VERSION_DATA_DIR = DATA_DIR / _config.get("data_dir", VERSION)
VERSION_OUTPUT_DIR = OUTPUT_DIR / VERSION

# Ensure output directory exists
VERSION_OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

# Input file
BIBLE_JSON_PATH = SOURCE_DATA_DIR / _config.get("source_file", f"{VERSION}_Bible.json")

# Version-specific data files
STOPWORDS_PATH = VERSION_DATA_DIR / _config.get("stopwords_file", "stopwords.txt")
PROTECTED_WORDS_PATH = VERSION_DATA_DIR / _config.get("protected_words_file", "protected_words.txt")
PROPER_NOUNS_PATH = VERSION_DATA_DIR / _config.get("proper_nouns_file", "proper_nouns.txt")

# Output files (version-specific)
# Step 1-4: Word extraction and filtering
RAW_WORDS_PATH = VERSION_OUTPUT_DIR / "step1_raw_words.json"
FILTERED_STOPWORDS_PATH = VERSION_OUTPUT_DIR / "step2_filtered_stopwords.json"
FILTERED_PROPER_NOUNS_PATH = VERSION_OUTPUT_DIR / "step3_filtered_proper_nouns.json"
STEP4_VOCABULARY_PATH = VERSION_OUTPUT_DIR / "step4_vocabulary.json"

# Step 5: Sentences extraction
STEP5_VOCABULARY_PATH = VERSION_OUTPUT_DIR / "step5_vocabulary_with_sentences.json"
STEP5_SENTENCES_PATH = VERSION_OUTPUT_DIR / "step5_sentences.json"

# Final outputs (with version tag for external use)
FINAL_VOCABULARY_PATH = VERSION_OUTPUT_DIR / f"final_vocabulary_{VERSION}.json"
FINAL_SENTENCES_PATH = VERSION_OUTPUT_DIR / f"final_sentences_{VERSION}.json"

# Legacy alias (for backward compatibility)
FINAL_OUTPUT_PATH = STEP4_VOCABULARY_PATH

# Processing options
MIN_WORD_LENGTH = _config.get("min_word_length", 2)
MIN_FREQUENCY = _config.get("min_frequency", 1)


def print_config():
    """Print current configuration."""
    print(f"Version: {VERSION} ({VERSION_NAME})")
    print(f"Language: {LANGUAGE}")
    print(f"Source: {BIBLE_JSON_PATH}")
    print(f"Output: {VERSION_OUTPUT_DIR}")
