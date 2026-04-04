#!/usr/bin/env python3
"""Upsert settings.scoring_few_shot from a JSON file (uses SUPABASE_* from scraper/.env).

Example::

    cd scraper && ../.venv/bin/python scripts/apply_scoring_few_shot_json.py scoring_few_shot.draft.json

Validate in Admin → Settings after apply, or re-save once to run web zod validation.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path
from typing import Any

from dotenv import load_dotenv
from supabase import create_client

_SCRAPER_ROOT = Path(__file__).resolve().parent.parent
if str(_SCRAPER_ROOT) not in sys.path:
    sys.path.insert(0, str(_SCRAPER_ROOT))

load_dotenv(_SCRAPER_ROOT / ".env")
load_dotenv(_SCRAPER_ROOT / ".env.local", override=True)


def _minimal_validate(payload: dict[str, Any]) -> None:
    if not isinstance(payload.get("intro"), str) or not str(payload["intro"]).strip():
        raise ValueError("intro must be a non-empty string")
    ex = payload.get("examples")
    if not isinstance(ex, list) or len(ex) < 1:
        raise ValueError("examples must be a non-empty array")
    for i, e in enumerate(ex):
        if not isinstance(e, dict):
            raise ValueError(f"examples[{i}] must be an object")
        if not isinstance(e.get("post_id"), str):
            raise ValueError(f"examples[{i}].post_id required")
        if not isinstance(e.get("ideal"), dict):
            raise ValueError(f"examples[{i}].ideal required")


def main() -> int:
    p = argparse.ArgumentParser(description="Upsert scoring_few_shot from JSON.")
    p.add_argument(
        "file",
        nargs="?",
        default=_SCRAPER_ROOT / "scoring_few_shot.draft.json",
        type=Path,
        help="Path to JSON (default: scraper/scoring_few_shot.draft.json)",
    )
    args = p.parse_args()
    path = args.file if args.file.is_absolute() else (_SCRAPER_ROOT / args.file).resolve()
    raw = path.read_text(encoding="utf-8")
    payload = json.loads(raw)
    if not isinstance(payload, dict):
        print("Root must be a JSON object", file=sys.stderr)
        return 1
    try:
        _minimal_validate(payload)
    except ValueError as e:
        print(e, file=sys.stderr)
        return 1

    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_KEY")
    if not url or not key:
        print("Missing SUPABASE_URL or SUPABASE_SERVICE_KEY", file=sys.stderr)
        return 1

    sb = create_client(url, key)
    sb.table("settings").upsert(
        {"key": "scoring_few_shot", "value": payload},
        on_conflict="key",
    ).execute()
    print(f"Upserted settings.scoring_few_shot from {path}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
