import { TOPIC_CATEGORIES } from "@/lib/constants";
import {
  type ScoringFewShotIdeal,
  VALID_WEIGHT_DIMENSIONS,
} from "@/lib/validators";

const topicSet = new Set<string>(TOPIC_CATEGORIES);

function clampDimensionScore(n: number): number {
  if (!Number.isFinite(n)) {
    return 5;
  }
  return Math.min(10, Math.max(1, n));
}

function parseStoredScores(raw: unknown): ScoringFewShotIdeal["scores"] {
  let obj: Record<string, unknown> = {};
  if (typeof raw === "string") {
    try {
      obj = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      obj = {};
    }
  } else if (raw && typeof raw === "object") {
    obj = raw as Record<string, unknown>;
  }
  const out = {} as Record<(typeof VALID_WEIGHT_DIMENSIONS)[number], number>;
  for (const dim of VALID_WEIGHT_DIMENSIONS) {
    const v = obj[dim];
    const n =
      typeof v === "number"
        ? v
        : typeof v === "string"
          ? parseFloat(v)
          : Number.NaN;
    out[dim] = clampDimensionScore(n);
  }
  return out;
}

/**
 * Map LLM categories to allowed few-shot topic categories (max 3).
 */
export function fewShotCategoriesFromLlm(
  llmCategories: null | string[] | undefined
): string[] {
  const filtered = (llmCategories ?? []).filter((c) => topicSet.has(c));
  filtered.sort();
  if (filtered.length === 0) {
    return ["drama"];
  }
  return filtered.slice(0, 3);
}

/**
 * Build a valid few-shot `ideal` from post text and optional llm_scores row.
 */
export function buildScoringFewShotIdeal(params: {
  llm: null | {
    categories?: string[];
    scores?: unknown;
    summary?: null | string;
    why_podcast_worthy?: null | string;
  };
  postText: string;
}): ScoringFewShotIdeal {
  const { llm, postText } = params;
  const t = postText.trim();
  const summaryFromLlm = llm?.summary?.trim();
  const summary =
    summaryFromLlm && summaryFromLlm.length > 0
      ? summaryFromLlm.slice(0, 2000)
      : t
        ? t.slice(0, 2000)
        : "No post text.";
  const whyFromLlm = llm?.why_podcast_worthy?.trim();
  const why_podcast_worthy =
    whyFromLlm && whyFromLlm.length > 0
      ? whyFromLlm.slice(0, 2000)
      : "Not recorded; refine in Scoring Few Shot settings.";
  return {
    categories: fewShotCategoriesFromLlm(llm?.categories),
    scores: parseStoredScores(llm?.scores),
    summary,
    why_podcast_worthy,
  };
}
