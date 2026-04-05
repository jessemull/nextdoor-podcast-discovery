"""LLM scoring helpers for the main scraper pipeline."""

from __future__ import annotations

import logging
import os
from typing import Any, cast

from anthropic import Anthropic
from supabase import Client

from src.llm_scorer import LLMScorer

logger = logging.getLogger(__name__)


def _run_scoring(
    supabase_client: Client,
    unscored_batch_limit: int = 50,
) -> None:
    """Run LLM scoring on unscored posts.

    Args:
        supabase_client: Supabase client instance.
        unscored_batch_limit: Max number of unscored posts to fetch and score (default 50).
    """
    anthropic = Anthropic(
        api_key=os.environ["ANTHROPIC_API_KEY"],
        timeout=120.0,
    )
    scorer = LLMScorer(anthropic, supabase_client)

    # Get unscored posts

    unscored = scorer.get_unscored_posts(limit=unscored_batch_limit)
    if not unscored:
        logger.info("No unscored posts found")
        return

    logger.info("Scoring %d unscored posts", len(unscored))

    # Score posts

    results = scorer.score_posts(unscored)
    results = scorer.calculate_final_scores(results)

    # Save scores

    stats = scorer.save_scores(results)
    logger.info(
        "Scoring complete: %d saved, %d skipped, %d errors",
        stats["saved"],
        stats["skipped"],
        stats["errors"],
    )


def _run_scoring_for_post(supabase_client: Client, post_id: str) -> bool:
    """Score a single post by ID.

    Args:
        supabase_client: Supabase client.
        post_id: UUID of the post to score.

    Returns:
        True if scoring succeeded, False otherwise.
    """
    result = (
        supabase_client.table("posts")
        .select("id, text, comments")
        .eq("id", post_id)
        .limit(1)
        .execute()
    )
    if not result.data or len(result.data) == 0:
        logger.warning("Post %s not found for scoring", post_id)
        return False

    anthropic = Anthropic(
        api_key=os.environ["ANTHROPIC_API_KEY"],
        timeout=120.0,
    )
    scorer = LLMScorer(anthropic, supabase_client)
    row = cast(dict[str, Any], result.data[0])
    posts_data = [row]
    results = scorer.score_posts(posts_data)
    results = scorer.calculate_final_scores(results)
    stats = scorer.save_scores(results)
    logger.info(
        "Scored post %s: saved=%d, skipped=%d, errors=%d",
        post_id,
        stats["saved"],
        stats["skipped"],
        stats["errors"],
    )
    return stats["saved"] > 0 or stats["skipped"] > 0
