import { describe, expect, it } from "vitest";

import { applyActiveFinalScore } from "@/lib/post-scores-active.server";

import type { LLMScore } from "@/lib/types";

const baseLlm: LLMScore = {
  categories: [],
  created_at: "2024-01-01T00:00:00Z",
  final_score: 1.6,
  id: "ls-1",
  model_version: "claude-3-haiku-20240307",
  post_id: "p-1",
  scores: {} as LLMScore["scores"],
  summary: null,
  why_podcast_worthy: null,
};

describe("applyActiveFinalScore", () => {
  it("should return null when llm_scores is null", () => {
    expect(applyActiveFinalScore(null, 9)).toBeNull();
  });

  it("should leave final_score unchanged when active value is undefined", () => {
    const out = applyActiveFinalScore(baseLlm, undefined);
    expect(out?.final_score).toBe(1.6);
  });

  it("should override final_score when post_scores provides a finite value", () => {
    const out = applyActiveFinalScore(baseLlm, 9);
    expect(out?.final_score).toBe(9);
    expect(out?.post_id).toBe("p-1");
  });

  it("should ignore non-finite active values", () => {
    expect(applyActiveFinalScore(baseLlm, NaN)?.final_score).toBe(1.6);
    expect(applyActiveFinalScore(baseLlm, Number.POSITIVE_INFINITY)?.final_score).toBe(
      1.6
    );
  });
});
