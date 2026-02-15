"""Prompt templates and constants for LLM scoring.

Extracted from llm_scorer for easier inspection and updates.
"""

__all__ = [
    "BATCH_SCORING_PROMPT",
    "BATCH_SCORING_RETRY_PROMPT",
    "BATCH_SIZE",
    "MAX_POST_LENGTH",
    "MAX_SUMMARY_LENGTH",
    "PROMPT_VERSION",
    "RUBRIC_SCALE",
    "SCORING_DIMENSIONS",
    "SCORING_PROMPT",
    "TOPIC_CATEGORIES",
]

# Version string for feedback loop and A/B tests; bump when prompt changes
PROMPT_VERSION = "v1"

# Maximum characters to send to Claude (longer posts are truncated)
MAX_POST_LENGTH = 2000

# Maximum characters for post summary
MAX_SUMMARY_LENGTH = 500

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
