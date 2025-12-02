"""Run the complete word extraction pipeline."""

import argparse
import os
import subprocess
import sys
from pathlib import Path


def run_step(script_name: str, version: str) -> bool:
    """Run a pipeline step and return success status."""
    scripts_dir = Path(__file__).parent / "scripts"
    script_path = scripts_dir / script_name
    print(f"\n{'='*60}")
    print(f"Running {script_name}...")
    print("=" * 60)

    # Set the version environment variable
    env = os.environ.copy()
    env["BIBLE_VERSION"] = version

    result = subprocess.run(
        [sys.executable, str(script_path)],
        cwd=scripts_dir,
        env=env,
    )

    return result.returncode == 0


def main():
    parser = argparse.ArgumentParser(
        description="Bible Vocabulary Extraction Pipeline"
    )
    parser.add_argument(
        "--version", "-v",
        default="niv",
        help="Bible version to process (default: niv)"
    )
    parser.add_argument(
        "--with-sentences",
        action="store_true",
        help="Also extract example sentences (Step 5)"
    )
    args = parser.parse_args()

    version = args.version.lower()

    print("=" * 60)
    print(f"Bible Vocabulary Extraction Pipeline")
    print(f"Version: {version.upper()}")
    print("=" * 60)

    steps = [
        "extract_words.py",
        "filter_stopwords.py",
        "filter_proper_nouns.py",
        "finalize.py",
    ]

    if args.with_sentences:
        steps.append("extract_sentences.py")

    for step in steps:
        if not run_step(step, version):
            print(f"\nError: {step} failed!")
            sys.exit(1)

    print("\n" + "=" * 60)
    print("Pipeline completed successfully!")
    print("=" * 60)
    print(f"\nOutput directory: output/{version}/")
    print(f"Main output: output/{version}/step4_vocabulary.json")
    if args.with_sentences:
        print(f"With sentences: output/{version}/step5_vocabulary_with_sentences.json")


if __name__ == "__main__":
    main()
