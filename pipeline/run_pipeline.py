"""Run the complete word extraction pipeline."""

import subprocess
import sys
from pathlib import Path


def run_step(script_name: str) -> bool:
    """Run a pipeline step and return success status."""
    script_path = Path(__file__).parent / script_name
    print(f"\n{'='*60}")
    print(f"Running {script_name}...")
    print("=" * 60)

    result = subprocess.run(
        [sys.executable, str(script_path)],
        cwd=script_path.parent,
    )

    return result.returncode == 0


def main():
    print("=" * 60)
    print("Bible Vocabulary Extraction Pipeline")
    print("=" * 60)

    steps = [
        "extract_words.py",
        "filter_stopwords.py",
        "filter_proper_nouns.py",
        "finalize.py",
    ]

    for step in steps:
        if not run_step(step):
            print(f"\nError: {step} failed!")
            sys.exit(1)

    print("\n" + "=" * 60)
    print("Pipeline completed successfully!")
    print("=" * 60)
    print("\nOutput file: pipeline/output/bible_vocabulary.json")


if __name__ == "__main__":
    main()
