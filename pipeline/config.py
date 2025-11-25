"""Pipeline configuration."""

from pathlib import Path

# Paths
PIPELINE_DIR = Path(__file__).parent
SOURCE_DATA_DIR = PIPELINE_DIR / "source-data"
DATA_DIR = PIPELINE_DIR / "data"
OUTPUT_DIR = PIPELINE_DIR / "output"

# Input
BIBLE_JSON_PATH = SOURCE_DATA_DIR / "NIV_Bible.json"

# Output files
RAW_WORDS_PATH = OUTPUT_DIR / "raw_words.json"
FILTERED_STOPWORDS_PATH = OUTPUT_DIR / "filtered_stopwords.json"
FILTERED_PROPER_NOUNS_PATH = OUTPUT_DIR / "filtered_proper_nouns.json"
FINAL_OUTPUT_PATH = OUTPUT_DIR / "bible_vocabulary.json"

# Proper nouns list
PROPER_NOUNS_PATH = DATA_DIR / "bible_proper_nouns.txt"

# Processing options
MIN_WORD_LENGTH = 2  # Minimum word length to include
MIN_FREQUENCY = 2    # Minimum frequency to include in final output
