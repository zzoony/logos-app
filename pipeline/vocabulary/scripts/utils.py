"""Common utility functions for pipeline scripts."""

from __future__ import annotations

import json
from datetime import datetime
from pathlib import Path
from typing import Any


def log(message: str, level: str = "INFO") -> None:
    """Print timestamped log message."""
    timestamp = datetime.now().strftime("%H:%M:%S")
    print(f"[{timestamp}] [{level}] {message}")


def load_json(path: Path) -> dict[str, Any]:
    """Load JSON file with error handling."""
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def save_json(path: Path, data: dict[str, Any], indent: int = 2) -> None:
    """Save data to JSON file."""
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=indent, ensure_ascii=False)


def load_text_list(path: Path) -> set[str]:
    """Load text file as set of lines (ignoring comments and empty lines)."""
    items = set()
    if not path.exists():
        return items

    with open(path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#"):
                items.add(line.lower())
    return items
