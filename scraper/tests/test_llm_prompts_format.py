"""Tests for prompt formatting helpers."""

from src.llm_prompts import format_prompt_with_example_block


def test_format_prompt_with_example_block_inserts_before_format_rest() -> None:
    """Should insert example block without interpreting JSON braces inside it."""
    template = "A:{a}\n{example_block}\nB:{b}"
    example = '{"scores": {"podcast_worthy": 9}}'
    out = format_prompt_with_example_block(template, example, a="1", b="2")
    assert example in out
    assert "A:1" in out
    assert "B:2" in out
    assert out.index(example) < out.index("B:2")


def test_format_prompt_with_example_block_no_placeholder() -> None:
    """Should behave like format when placeholder absent."""
    out = format_prompt_with_example_block("X:{x}", "ignored", x="y")
    assert out == "X:y"
