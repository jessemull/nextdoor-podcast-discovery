"""Claude API calls for batch and single-post scoring."""

from __future__ import annotations

import json
import logging
from collections.abc import Callable
from typing import Any, cast

from anthropic import Anthropic

from src.config import CLAUDE_MODEL
from src.llm_prompts import (
    BATCH_SCORING_PROMPT,
    BATCH_SCORING_RETRY_PROMPT,
    MAX_SUMMARY_LENGTH,
    RUBRIC_SCALE,
    SCORING_DIMENSIONS,
    SCORING_PROMPT,
    SINGLE_DIMENSION_SCORING_PROMPT,
    SINGLE_DIMENSION_SCORING_RETRY_PROMPT,
    TOPIC_CATEGORIES,
    build_post_text_for_scoring,
    format_prompt_with_example_block,
)
from src.llm_score_result import PostScore, strip_json_from_markdown

logger = logging.getLogger(__name__)


class LLMScorerClaudeCalls:
    """Encapsulates Anthropic message calls and JSON parsing for scoring."""

    def __init__(
        self,
        anthropic_client: Anthropic,
        few_shot_block: Callable[[], str],
    ) -> None:
        self.anthropic = anthropic_client
        self._few_shot_block = few_shot_block

    def score_batch_single_run(
        self,
        posts: list[dict[str, Any]],
        temperature: float,
    ) -> list[PostScore]:
        """Score a batch in one API call. Raises on failure."""
        dimension_desc = "\n".join(
            f"- {dim}: {desc}" for dim, desc in SCORING_DIMENSIONS.items()
        )

        posts_text = "\n\n".join(
            f"[Post {i}] (id={p.get('id')})\n{build_post_text_for_scoring(p)}"
            for i, p in enumerate(posts)
        )
        example_block = self._few_shot_block()
        prompt = format_prompt_with_example_block(
            BATCH_SCORING_PROMPT,
            example_block,
            categories=", ".join(TOPIC_CATEGORIES),
            dimension_descriptions=dimension_desc,
            posts_text=posts_text,
            rubric_scale=RUBRIC_SCALE,
        )

        max_attempts = 3
        messages: list[dict[str, Any]] = [{"content": prompt, "role": "user"}]
        parsed: Any = None
        raw_response = ""

        for attempt in range(max_attempts):
            response = self.anthropic.messages.create(
                max_tokens=500 * len(posts),
                model=CLAUDE_MODEL,
                messages=cast("Any", messages),
                temperature=temperature,
            )

            content_block = response.content[0]
            raw_response = getattr(content_block, "text", "")

            parse_error: json.JSONDecodeError | None = None
            for text_to_parse in (
                raw_response,
                strip_json_from_markdown(raw_response),
            ):
                if not text_to_parse:
                    continue
                try:
                    parsed = json.loads(text_to_parse)
                    parse_error = None
                    break
                except json.JSONDecodeError as e:
                    parse_error = e
                    continue
            else:
                err = parse_error or json.JSONDecodeError(
                    "Invalid JSON", raw_response, 0
                )
                if attempt < max_attempts - 1:
                    logger.warning(
                        "Batch JSON parse error (attempt %d/%d, retrying with feedback): %s",
                        attempt + 1,
                        max_attempts,
                        err,
                    )
                    messages.append({"content": raw_response, "role": "assistant"})
                    messages.append(
                        {
                            "content": BATCH_SCORING_RETRY_PROMPT.format(
                                error=str(err)
                            ),
                            "role": "user",
                        }
                    )
                else:
                    raise ValueError(
                        f"JSON parse error after {max_attempts} attempts: {err}"
                    ) from err
                continue

            break

        if not isinstance(parsed, list):
            raise ValueError("Invalid batch response format: not a list")

        results = []
        parsed_by_index: dict[int, dict[str, Any]] = {
            int(item.get("post_index", idx)): item
            for idx, item in enumerate(parsed)
            if isinstance(item, dict)
        }

        for i, post in enumerate(posts):
            item = parsed_by_index.get(i)
            if not item:
                raise ValueError(f"Missing result in batch response for post index {i}")

            scores = item.get("scores", {})
            validated_scores = {}
            for dim in SCORING_DIMENSIONS:
                s = scores.get(dim)
                validated_scores[dim] = (
                    float(s) if isinstance(s, (int, float)) and 1 <= s <= 10 else 5.0
                )
            pw = scores.get("podcast_worthy")
            if isinstance(pw, (int, float)) and 1 <= pw <= 10:
                validated_scores["podcast_worthy"] = float(pw)

            raw_cats = item.get("categories", [])
            categories = [c for c in raw_cats if c in TOPIC_CATEGORIES]
            summary = (item.get("summary") or "")[:MAX_SUMMARY_LENGTH]
            why_podcast_worthy = (item.get("why_podcast_worthy") or "")[
                :MAX_SUMMARY_LENGTH
            ].strip() or None

            results.append(
                PostScore(
                    post_id=post.get("id", "unknown"),
                    scores=validated_scores,
                    categories=categories,
                    summary=summary,
                    why_podcast_worthy=why_podcast_worthy,
                )
            )

        return results

    def score_single_dimension_batch(
        self,
        posts: list[dict[str, Any]],
        dimension: str,
    ) -> list[tuple[str, float]]:
        """Score one dimension for a batch of posts. Raises on parse failure after retries."""
        description = SCORING_DIMENSIONS[dimension]
        if isinstance(description, tuple):
            description = description[0] if description else ""
        else:
            description = str(description)
        posts_text = "\n\n".join(
            f"[Post {i}] (id={p.get('id')})\n{build_post_text_for_scoring(p)}"
            for i, p in enumerate(posts)
        )
        example_block = self._few_shot_block()
        prompt = format_prompt_with_example_block(
            SINGLE_DIMENSION_SCORING_PROMPT,
            example_block,
            description=description,
            dimension=dimension,
            posts_text=posts_text,
            rubric_scale=RUBRIC_SCALE,
        )

        max_attempts = 3
        messages: list[dict[str, Any]] = [{"content": prompt, "role": "user"}]
        parsed: Any = None
        raw_response = ""

        for attempt in range(max_attempts):
            response = self.anthropic.messages.create(
                max_tokens=500 * len(posts),
                model=CLAUDE_MODEL,
                messages=cast("Any", messages),
                temperature=0,
            )
            content_block = response.content[0]
            raw_response = getattr(content_block, "text", "")

            parse_error: json.JSONDecodeError | None = None
            for text_to_parse in (
                raw_response,
                strip_json_from_markdown(raw_response),
            ):
                if not text_to_parse:
                    continue
                try:
                    parsed = json.loads(text_to_parse)
                    parse_error = None
                    break
                except json.JSONDecodeError as e:
                    parse_error = e
                    continue
            else:
                err = parse_error or json.JSONDecodeError(
                    "Invalid JSON", raw_response, 0
                )
                if attempt < max_attempts - 1:
                    logger.warning(
                        "Single-dimension batch JSON parse error (attempt %d/%d): %s",
                        attempt + 1,
                        max_attempts,
                        err,
                    )
                    messages.append({"content": raw_response, "role": "assistant"})
                    messages.append(
                        {
                            "content": SINGLE_DIMENSION_SCORING_RETRY_PROMPT.format(
                                dimension=dimension,
                                error=str(err),
                            ),
                            "role": "user",
                        },
                    )
                else:
                    raise ValueError(
                        f"JSON parse error after {max_attempts} attempts: {err}"
                    ) from err
                continue

            break

        if not isinstance(parsed, list):
            raise ValueError("Invalid single-dimension response: not a list")

        parsed_by_index: dict[int, dict[str, Any]] = {
            int(item.get("post_index", idx)): item
            for idx, item in enumerate(parsed)
            if isinstance(item, dict)
        }
        out: list[tuple[str, float]] = []
        for i, post in enumerate(posts):
            item = parsed_by_index.get(i)
            if not item:
                raise ValueError(
                    f"Missing result in single-dimension response for post index {i}"
                )
            scores = item.get("scores") or {}
            raw = scores.get(dimension)
            if isinstance(raw, (int, float)) and 1 <= raw <= 10:
                value = float(raw)
            else:
                value = 5.0
            out.append((post.get("id", "unknown"), value))
        return out

    def score_single_post(self, post: dict[str, Any]) -> PostScore:
        """Score a single post using Claude."""
        post_id = post.get("id", "unknown")
        post_text = post.get("text", "")

        if not post_text or not post_text.strip():
            return PostScore(
                post_id=post_id,
                scores={},
                categories=[],
                summary="",
                error="Empty post text",
            )

        body_with_comments = build_post_text_for_scoring(post)

        dimension_desc = "\n".join(
            f"- {dim}: {desc}" for dim, desc in SCORING_DIMENSIONS.items()
        )
        example_block = self._few_shot_block()
        prompt = format_prompt_with_example_block(
            SCORING_PROMPT,
            example_block,
            categories=", ".join(TOPIC_CATEGORIES),
            dimension_descriptions=dimension_desc,
            post_text=body_with_comments,
            rubric_scale=RUBRIC_SCALE,
        )

        response = self.anthropic.messages.create(
            max_tokens=500,
            model=CLAUDE_MODEL,
            messages=[{"content": prompt, "role": "user"}],
            temperature=0,
        )

        content_block = response.content[0]
        raw_response = getattr(content_block, "text", "")

        try:
            data = json.loads(raw_response)
        except json.JSONDecodeError as e:
            logger.warning("Failed to parse JSON for post %s: %s", post_id, e)
            return PostScore(
                post_id=post_id,
                scores={},
                categories=[],
                summary="",
                error=f"JSON parse error: {e}",
                raw_response=raw_response,
            )

        scores = data.get("scores", {})
        validated_scores = {}

        for dim in SCORING_DIMENSIONS:
            score = scores.get(dim)
            if isinstance(score, (int, float)) and 1 <= score <= 10:
                validated_scores[dim] = float(score)
            else:
                validated_scores[dim] = 5.0

        pw = scores.get("podcast_worthy")
        if isinstance(pw, (int, float)) and 1 <= pw <= 10:
            validated_scores["podcast_worthy"] = float(pw)

        raw_categories = data.get("categories", [])
        categories = [c for c in raw_categories if c in TOPIC_CATEGORIES]

        summary = data.get("summary", "")[:MAX_SUMMARY_LENGTH]
        why_podcast_worthy = (data.get("why_podcast_worthy") or "")[
            :MAX_SUMMARY_LENGTH
        ].strip() or None

        return PostScore(
            post_id=post_id,
            scores=validated_scores,
            categories=categories,
            summary=summary,
            why_podcast_worthy=why_podcast_worthy,
            raw_response=raw_response,
        )
