"""Tests for compare_env_context (prod vs dev scoring comparison helpers)."""

from unittest.mock import MagicMock, patch

from src.compare_env_context import (
    body_content_fingerprint,
    collect_env_snapshot,
    explain_final_score,
    few_shot_fingerprint,
    resolve_post_row,
)
from src.llm_scorer import PostScore


def test_body_content_fingerprint_stable():
    """Should produce the same digest for identical text and comments."""
    fp1 = body_content_fingerprint("hello", [])
    fp2 = body_content_fingerprint("hello", [])
    assert fp1 == fp2
    assert len(fp1) == 64


def test_body_content_fingerprint_differs_on_text():
    """Should differ when post body changes."""
    a = body_content_fingerprint("a", None)
    b = body_content_fingerprint("b", None)
    assert a != b


def test_few_shot_fingerprint_absent():
    """Should report absent when raw config is None."""
    fp = few_shot_fingerprint(None)
    assert fp["present"] is False
    assert fp["sha256"] is None
    assert fp["example_count"] == 0


def test_few_shot_fingerprint_with_examples():
    """Should count examples and hash canonical JSON."""
    raw = {"examples": [{"post_id": "x"}], "intro": "hi"}
    fp = few_shot_fingerprint(raw)
    assert fp["present"] is True
    assert fp["example_count"] == 1
    assert fp["sha256"] is not None


@patch("src.compare_env_context.count_llm_scores", return_value=100)
@patch("src.compare_env_context._load_scoring_few_shot_raw", return_value=None)
@patch(
    "src.compare_env_context.load_novelty_config",
    return_value={"max_multiplier": 1.0, "min_multiplier": 1.0},
)
@patch("src.compare_env_context.load_weight_config")
@patch("src.compare_env_context.get_active_weight_config_id", return_value="cfg-1")
def test_collect_env_snapshot_with_config(mock_get_active, mock_load_wc, *_mocks):
    """Should load weights and metadata when an active config exists."""
    assert mock_get_active.return_value == "cfg-1"
    mock_load_wc.return_value = {"drama": 1.0, "readability": 0.5}
    supabase = MagicMock()
    snap = collect_env_snapshot(
        supabase,
        label="test",
        claude_model="claude-test",
        prompt_version="pv1",
        ensemble_runs=3,
    )
    assert snap["label"] == "test"
    assert snap["active_weight_config_id"] == "cfg-1"
    assert snap["weights"]["drama"] == 1.0
    assert snap["llm_scores_cold_start"] is False
    assert snap["few_shot"]["present"] is False
    assert snap["model"]["claude"] == "claude-test"


def test_resolve_post_row_slug(monkeypatch):
    """Should return the first row from slug fetch."""

    def fake_fetch(_client, slug):
        assert slug == "abc"
        return [{"comments": [], "id": "u1", "text": "t"}]

    monkeypatch.setattr("src.compare_env_context._fetch_by_slug", fake_fetch)
    supabase = MagicMock()
    row = resolve_post_row(supabase, ("slug", "abc"))
    assert row is not None
    assert row["id"] == "u1"


@patch("src.compare_env_context.count_llm_scores", return_value=100)
@patch("src.compare_env_context.load_topic_frequencies", return_value={})
@patch(
    "src.compare_env_context.load_novelty_config",
    return_value={"max_multiplier": 1.0, "min_multiplier": 1.0},
)
@patch("src.compare_env_context.load_weight_config", return_value={"drama": 1.0})
@patch("src.compare_env_context.get_active_weight_config_id", return_value="cfg")
def test_explain_final_score_matches_calculator(*_mocks):
    """Should match calculate_final_score when novelty is neutral (no frequencies)."""
    ps = PostScore(
        post_id="p1",
        scores={"drama": 8.0},
        categories=["drama"],
        summary="",
    )
    ps.final_score = 8.0
    supabase = MagicMock()
    out = explain_final_score(supabase, ps)
    assert out["novelty"] == 1.0
    assert out["final_score_check"] == 8.0
    assert out["matches_post_score"] is True
