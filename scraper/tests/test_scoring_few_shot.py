"""Tests for DB-backed scoring few-shot block."""

from unittest.mock import MagicMock, Mock

import pytest

from src.exceptions import ConfigurationError
from src.llm_prompts import SCORING_DIMENSIONS
from src.scoring_few_shot import SETTINGS_KEY, build_scoring_few_shot_block

_DIMS = sorted(SCORING_DIMENSIONS.keys())


def _ideal_payload() -> dict:
    return {
        "categories": ["drama"],
        "scores": {k: 7.0 for k in _DIMS},
        "summary": "Test summary",
        "why_podcast_worthy": "Because test.",
    }


def test_build_scoring_few_shot_block_raises_when_settings_missing() -> None:
    """Should raise ConfigurationError when no scoring_few_shot row."""
    supabase = MagicMock()
    chain = MagicMock()
    chain.execute.return_value = Mock(data=[])
    supabase.table.return_value.select.return_value.eq.return_value.limit.return_value = chain

    with pytest.raises(ConfigurationError, match=SETTINGS_KEY):
        build_scoring_few_shot_block(supabase)


def test_build_scoring_few_shot_block_formats_thread_and_ideal() -> None:
    """Should load posts and include thread + ideal JSON in output."""
    post_id = "550e8400-e29b-41d4-a716-446655440000"
    config = {
        "examples": [{"ideal": _ideal_payload(), "post_id": post_id}],
        "intro": "Calibration intro line.",
    }

    def table_side_effect(name: str) -> MagicMock:
        t = MagicMock()
        if name == "settings":
            ch = MagicMock()
            ch.execute.return_value = Mock(data=[{"value": config}])
            t.select.return_value.eq.return_value.limit.return_value = ch
        elif name == "posts":
            ch = MagicMock()
            ch.execute.return_value = Mock(
                data=[
                    {
                        "comments": [],
                        "id": post_id,
                        "post_id_ext": "abc",
                        "text": "Neighbor drama here.",
                        "url": "https://x/p/abc",
                    }
                ]
            )
            t.select.return_value.eq.return_value.limit.return_value = ch
        return t

    supabase = MagicMock()
    supabase.table.side_effect = table_side_effect

    block = build_scoring_few_shot_block(supabase)

    assert "Calibration intro line." in block
    assert "Neighbor drama here." in block
    assert "Reference example 1" in block
    assert '"podcast_worthy":' in block
