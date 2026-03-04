#!/usr/bin/env python3
"""Validate that required scraper environment variables are set (for production host)."""

import os
import sys
from pathlib import Path

# Required vars must match scraper/src/config.py REQUIRED_ENV_VARS
REQUIRED_ENV_VARS = [
    "ANTHROPIC_API_KEY",
    "NEXTDOOR_EMAIL",
    "NEXTDOOR_PASSWORD",
    "OPENAI_API_KEY",
    "SESSION_ENCRYPTION_KEY",
    "SUPABASE_SERVICE_KEY",
    "SUPABASE_URL",
]


def main():
    repo_root = Path(__file__).resolve().parent.parent
    env_file = repo_root / "scraper" / ".env"

    if env_file.exists():
        try:
            from dotenv import load_dotenv

            load_dotenv(env_file)
        except ImportError:
            pass  # Proceed with os.environ only

    missing = [v for v in REQUIRED_ENV_VARS if not os.environ.get(v, "").strip()]
    if missing:
        print("Missing or empty required environment variables:", ", ".join(missing))
        print("Edit scraper/.env with production values. See docs/HOST_ENV_CHECKLIST.md")
        sys.exit(1)

    print("All required scraper environment variables are set.")
    return 0


if __name__ == "__main__":
    sys.exit(main() or 0)
