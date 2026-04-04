#!/usr/bin/env python3
"""Re-run LLM scoring for posts listed in a newline file (UUIDs or Nextdoor /p/ URLs).

Upserts ``llm_scores`` (and ``post_scores`` for the active weight config) using the
current prompt in ``llm_prompts`` (see ``PROMPT_VERSION``).

Requires the usual scraper env (``validate_env``): Supabase, Anthropic, OpenAI, session
key, Nextdoor credentials, etc.

If ``settings.scoring_few_shot`` is missing, rescoring continues **without** a few-shot
block (one warning). Use ``--strict-few-shot`` to require Admin calibration like production.

Usage::

    cd scraper && ../.venv/bin/python scripts/rescore_posts_file.py ../urls.txt

From repo root::

    make rescore-urls FILE=./urls.txt
"""

from __future__ import annotations

import argparse
import logging
import os
import sys
from pathlib import Path

# Run from scraper/: treat scraper/ as package root (same as compare_env_scores.py)
_SCRAPER_ROOT = Path(__file__).resolve().parent.parent
if str(_SCRAPER_ROOT) not in sys.path:
    sys.path.insert(0, str(_SCRAPER_ROOT))

from anthropic import Anthropic  # noqa: E402
from dotenv import load_dotenv  # noqa: E402
from supabase import create_client  # noqa: E402

load_dotenv(_SCRAPER_ROOT / ".env")
load_dotenv(_SCRAPER_ROOT / ".env.local", override=True)

from src.config import validate_env  # noqa: E402
from src.exceptions import ConfigurationError  # noqa: E402
from src.llm_scorer import LLMScorer  # noqa: E402
from src.logging_config import configure_logging  # noqa: E402
from src.tuning_posts_lib import (  # noqa: E402
    load_tuning_lines,
    resolve_tuning_file_path,
    resolve_tuning_posts,
)

configure_logging("rescore-posts-file")
logger = logging.getLogger(__name__)


class _RescoreLLMScorer(LLMScorer):
    """Proceed without few-shot when settings.scoring_few_shot is missing (local/dev)."""

    def _scoring_few_shot_block(self) -> str:
        try:
            return super()._scoring_few_shot_block()
        except ConfigurationError as e:
            if not getattr(self, "_rescore_few_shot_warned", False):
                logger.warning(
                    "settings.scoring_few_shot missing; rescoring without few-shot block. "
                    "Add Admin → Settings → Scoring few-shot for calibration parity with production. (%s)",
                    e,
                )
                self._rescore_few_shot_warned = True
            return ""


def main() -> int:
    parser = argparse.ArgumentParser(
        description=(
            "Re-score posts from a tuning file (upserts llm_scores with the current prompt)."
        )
    )
    parser.add_argument(
        "--strict-few-shot",
        action="store_true",
        help="Fail if settings.scoring_few_shot is missing (default: omit few-shot and continue)",
    )
    parser.add_argument(
        "file",
        nargs="?",
        default=Path("urls.txt"),
        type=Path,
        help="Newline-separated UUIDs or Nextdoor URLs (default: urls.txt)",
    )
    args = parser.parse_args()

    try:
        validate_env()
    except ConfigurationError as e:
        logger.error("%s", e)
        return 1

    path = resolve_tuning_file_path(args.file)
    try:
        lines = load_tuning_lines(path)
    except FileNotFoundError as e:
        logger.error("%s", e)
        return 1

    supabase = create_client(
        os.environ["SUPABASE_URL"],
        os.environ["SUPABASE_SERVICE_KEY"],
    )
    posts, issues = resolve_tuning_posts(supabase, lines)
    for msg in issues:
        logger.warning("%s", msg)

    if not posts:
        logger.error("No posts resolved; nothing to score")
        return 1

    slim: list[dict[str, object]] = []
    for p in posts:
        pid = p.get("id")
        if pid is None:
            logger.error("Resolved row missing id")
            return 1
        slim.append(
            {
                "comments": p.get("comments"),
                "id": pid,
                "text": p.get("text"),
            }
        )

    logger.info("Scoring %d posts from %s", len(slim), path)

    anthropic = Anthropic(
        api_key=os.environ["ANTHROPIC_API_KEY"],
        timeout=120.0,
    )
    scorer_cls = LLMScorer if args.strict_few_shot else _RescoreLLMScorer
    scorer = scorer_cls(anthropic, supabase)
    results = scorer.score_posts(slim)
    results = scorer.calculate_final_scores(results)
    stats = scorer.save_scores(results)
    logger.info(
        "Done: saved=%d skipped=%d errors=%d",
        stats["saved"],
        stats["skipped"],
        stats["errors"],
    )
    return 1 if stats["errors"] else 0


if __name__ == "__main__":
    sys.exit(main())
