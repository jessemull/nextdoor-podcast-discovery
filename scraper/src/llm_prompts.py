"""Prompt templates and constants for LLM scoring.

Extracted from llm_scorer for easier inspection and updates.
"""

from __future__ import annotations

import json
from typing import Any

__all__ = [
    "BATCH_SCORING_PROMPT",
    "BATCH_SCORING_RETRY_PROMPT",
    "BATCH_SIZE",
    "MAX_COMMENT_TEXT_LENGTH",
    "MAX_COMMENTS_PER_POST",
    "MAX_COMMENTS_TOTAL_CHARS",
    "MAX_POST_LENGTH",
    "MAX_SUMMARY_LENGTH",
    "PROMPT_VERSION",
    "RUBRIC_SCALE",
    "SCORING_DIMENSIONS",
    "SCORING_PROMPT",
    "SINGLE_DIMENSION_SCORING_PROMPT",
    "SINGLE_DIMENSION_SCORING_RETRY_PROMPT",
    "TOPIC_CATEGORIES",
    "build_post_text_for_scoring",
    "format_comments_for_scoring_prompt",
]

# Version string for feedback loop and A/B tests; bump when prompt changes
PROMPT_VERSION = "v2"

# Maximum characters to send to Claude (longer posts are truncated)
MAX_POST_LENGTH = 2000

# Thread comments (scraped neighbor replies); caps limit Anthropic input tokens
MAX_COMMENTS_PER_POST = 20
MAX_COMMENT_TEXT_LENGTH = 400
MAX_COMMENTS_TOTAL_CHARS = 4000

# Maximum characters for post summary
MAX_SUMMARY_LENGTH = 500


def format_comments_for_scoring_prompt(comments: Any) -> str:
    """Format posts.comments JSON for the scoring prompt with hard caps.

    Returns empty string when there are no usable comments.
    """
    if comments is None:
        return ""
    if isinstance(comments, str):
        try:
            comments = json.loads(comments)
        except json.JSONDecodeError:
            return ""
    if not isinstance(comments, list) or len(comments) == 0:
        return ""

    lines: list[str] = []
    total_chars = 0
    included = 0
    for item in comments:
        if included >= MAX_COMMENTS_PER_POST:
            remaining = max(0, len(comments) - included)
            if remaining > 0:
                lines.append(
                    f"[{remaining} more comments omitted (max {MAX_COMMENTS_PER_POST} shown)]"
                )
            break
        if not isinstance(item, dict):
            continue
        author = str(item.get("author_name") or "Unknown").strip() or "Unknown"
        body = str(item.get("text") or "").strip()
        if not body:
            continue
        truncated = body
        if len(truncated) > MAX_COMMENT_TEXT_LENGTH:
            truncated = (
                body[:MAX_COMMENT_TEXT_LENGTH]
                + f"\n[Comment text truncated at {MAX_COMMENT_TEXT_LENGTH} characters]"
            )
        line = f"{included + 1}. {author}: {truncated}"
        sep = 1 if lines else 0
        if total_chars + sep + len(line) > MAX_COMMENTS_TOTAL_CHARS:
            lines.append(
                f"[Further comments omitted; thread budget {MAX_COMMENTS_TOTAL_CHARS} characters]"
            )
            break
        if lines:
            total_chars += 1
        lines.append(line)
        total_chars += len(line)
        included += 1

    return "\n".join(lines)


def build_post_text_for_scoring(post: dict[str, Any]) -> str:
    """Truncated post body plus optional Comments section for Claude."""
    raw = post.get("text") or ""
    text = str(raw)
    sliced = text[:MAX_POST_LENGTH]
    if len(text) > MAX_POST_LENGTH:
        sliced += f"\n[Text truncated at {MAX_POST_LENGTH} characters]"

    comments_block = format_comments_for_scoring_prompt(post.get("comments"))
    if comments_block:
        return sliced + "\n\nComments:\n" + comments_block
    return sliced


# Shared rubric scale for scoring dimensions
RUBRIC_SCALE = "0=skip, 3=low, 5=neutral, 7=good, 10=perfect"

# Scoring dimensions with descriptions and explicit anchors
# Order matches the JSON example in the prompt for consistency
SCORING_DIMENSIONS = {
    "absurdity": (
        "How ridiculous, unhinged, or 'peak Nextdoor' is this post? "
        "1=mundane, 5=moderate, 10=absolutely unhinged"
    ),
    "discussion_spark": (
        "Would listeners want to discuss this? "
        "1=boring, 5=some debate, 10=everyone has an opinion"
    ),
    "drama": (
        "Level of conflict, tension, or heated exchanges. "
        "1=peaceful, 5=some friction, 10=full-blown neighbor war"
    ),
    "emotional_intensity": (
        "Passion level - caps, exclamation marks, strong language. "
        "1=calm, 5=moderate, 10=screaming"
    ),
    "news_value": (
        "Did something actually happen worth reporting? "
        "1=nothing, 5=notable, 10=major incident"
    ),
    "podcast_worthy": (
        "Would this work well on a comedy podcast? "
        "1=skip, 5=maybe, 10=perfect for the show"
    ),
    "readability": (
        "How easy and punchy is this to read aloud? Short, clear posts score higher; "
        "walls of text score lower. 1=rambling/long, 5=ok, 10=concise and punchy"
    ),
}

# Topic categories for frequency tracking
TOPIC_CATEGORIES = [
    "crime",
    "drama",
    "humor",
    "local_news",
    "lost_pet",
    "noise",
    "suspicious",
    "wildlife",
]

# The scoring prompt template
SCORING_PROMPT = """You are analyzing Nextdoor posts for a comedy podcast.

Each item may include the original post text plus a "Comments:" section with neighbor replies from the thread.
Use the full thread (post + comments) when scoring—especially discussion_spark, drama, and emotional_intensity.
If there are no comments, score from the post text alone.

Score this post on each dimension from 1-10. Scale: {rubric_scale}

{dimension_descriptions}

Think step-by-step internally. Respond with ONLY valid JSON.

Also assign 1-3 topic categories from this list: {categories}

Post to analyze:
---
{post_text}
---

Also provide "why_podcast_worthy": one short sentence explaining why this is good for the podcast (e.g. "Good for podcast because: ...").

Respond with ONLY valid JSON in this exact format:
{{
    "scores": {{
        "absurdity": <1-10>,
        "discussion_spark": <1-10>,
        "drama": <1-10>,
        "emotional_intensity": <1-10>,
        "news_value": <1-10>,
        "podcast_worthy": <1-10>,
        "readability": <1-10>
    }},
    "categories": ["category1", "category2"],
    "summary": "<one sentence summary of the post>",
    "why_podcast_worthy": "<one sentence: why this is good for the podcast>"
}}"""

# Batch scoring: multiple posts per API call
BATCH_SIZE = 5

BATCH_SCORING_PROMPT = """You are analyzing Nextdoor posts for a comedy podcast.

Each numbered post may include the original text plus a "Comments:" section with neighbor replies.
Use the full thread (post + comments) when scoring—especially discussion_spark, drama, and emotional_intensity.
If a post has no comments section, score from the post text alone.

Score each post on these dimensions (1-10). Scale: {rubric_scale}

{dimension_descriptions}

Think step-by-step internally. Respond with ONLY valid JSON.

Also assign 1-3 topic categories from this list to each post: {categories}

Posts to analyze (each numbered):
{posts_text}

Also provide "why_podcast_worthy" (one short sentence) per post explaining why it's good for the podcast.

Respond with ONLY a valid JSON array—no markdown, no code fences, no trailing commas.
Escape any double quotes inside strings (e.g. use \\" for a quote in summary or why_podcast_worthy).
One object per post, in order. Format:
[
  {{"post_index": 0, "scores": {{"absurdity": N, "discussion_spark": N, "drama": N, "emotional_intensity": N, "news_value": N, "podcast_worthy": N, "readability": N}}, "categories": ["cat1"], "summary": "...", "why_podcast_worthy": "..."}},
  {{"post_index": 1, ...}}
]"""

# Message to send on retry when the model's JSON was invalid
BATCH_SCORING_RETRY_PROMPT = """Your previous response had invalid JSON: {error}

Please respond again with ONLY a valid JSON array. No markdown, no code blocks, no trailing commas. Escape double quotes inside strings with \\"."""

# Single-dimension backfill: score only one dimension (1-10) for each post
SINGLE_DIMENSION_SCORING_PROMPT = """You are analyzing Nextdoor posts for a comedy podcast.

Each numbered post may include a "Comments:" section with neighbor replies; use the full thread when it helps judge this dimension.
If there are no comments, use the post text alone.

Score each post on ONLY this dimension (1-10): {dimension}

Description: {description}

Scale: {rubric_scale}

Respond with ONLY a valid JSON array—no markdown, no code fences, no trailing commas.
One object per post, in order. Format:
[
  {{"post_index": 0, "scores": {{"{dimension}": <1-10>}}}},
  {{"post_index": 1, "scores": {{"{dimension}": <1-10>}}}}
]

Posts to analyze (each numbered):
{posts_text}"""

SINGLE_DIMENSION_SCORING_RETRY_PROMPT = """Your previous response had invalid JSON: {error}

Please respond again with ONLY a valid JSON array. No markdown, no code blocks. Format: [{{"post_index": 0, "scores": {{"{dimension}": N}}}}, ...]"""
