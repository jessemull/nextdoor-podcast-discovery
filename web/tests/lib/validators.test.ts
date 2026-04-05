import { describe, expect, it } from "vitest";

import {
  adminJobsQuerySchema,
  backfillDimensionBodySchema,
  permalinkQueueBodySchema,
  postsBulkBodySchema,
  postsBulkCountBodySchema,
  postsQuerySchema,
  postsSavedBodySchema,
  postsUsedBodySchema,
  recomputeScoresBodySchema,
  scoringFewShotAddPostsBodySchema,
  scoringFewShotConfigSchema,
  searchBodySchema,
  searchQuerySchema,
  settingsPutBodySchema,
  triggerScrapeBodySchema,
  UUID_REGEX,
  VALID_WEIGHT_DIMENSIONS,
  weightConfigPatchBodySchema,
} from "@/lib/validators";

const POST_UUID = "550e8400-e29b-41d4-a716-446655440001";
const NB_UUID = "660e8400-e29b-41d4-a716-446655440002";

function fullRankingWeights() {
  return Object.fromEntries(VALID_WEIGHT_DIMENSIONS.map((d) => [d, 5])) as Record<
    (typeof VALID_WEIGHT_DIMENSIONS)[number],
    number
  >;
}

const validIdeal = {
  categories: ["crime"] as const,
  scores: {
    absurdity: 5,
    discussion_spark: 5,
    drama: 5,
    emotional_intensity: 5,
    news_value: 5,
    podcast_worthy: 5,
    readability: 5,
  },
  summary: "A short summary of the post.",
  why_podcast_worthy: "Because it is interesting.",
};

describe("UUID_REGEX", () => {
  it("should accept lowercase UUID v4", () => {
    expect(UUID_REGEX.test(POST_UUID)).toBe(true);
  });

  it("should reject non-UUID strings", () => {
    expect(UUID_REGEX.test("not-a-uuid")).toBe(false);
  });
});

describe("searchQuerySchema", () => {
  it("should clamp limit to 1–50 via transform", () => {
    const high = searchQuerySchema.safeParse({ limit: "999", q: "hello" });
    expect(high.success).toBe(true);
    if (high.success) expect(high.data.limit).toBe(50);

    const zero = searchQuerySchema.safeParse({ limit: "0", q: "hello" });
    expect(zero.success).toBe(true);
    if (zero.success) expect(zero.data.limit).toBe(1);

    const low = searchQuerySchema.safeParse({ limit: "1", q: "hello" });
    expect(low.success).toBe(true);
    if (low.success) expect(low.data.limit).toBe(1);
  });

  it("should reject empty q", () => {
    const r = searchQuerySchema.safeParse({ q: "   " });
    expect(r.success).toBe(false);
  });
});

describe("searchBodySchema", () => {
  it("should clamp similarity_threshold into 0–1 via transform", () => {
    const high = searchBodySchema.safeParse({
      query: "x",
      similarity_threshold: 2,
    });
    expect(high.success).toBe(true);
    if (high.success) expect(high.data.similarity_threshold).toBe(1);

    const mid = searchBodySchema.safeParse({
      query: "x",
      similarity_threshold: 0.25,
    });
    expect(mid.success).toBe(true);
    if (mid.success) expect(mid.data.similarity_threshold).toBe(0.25);

    const neg = searchBodySchema.safeParse({
      query: "x",
      similarity_threshold: -1,
    });
    expect(neg.success).toBe(true);
    if (neg.success) expect(neg.data.similarity_threshold).toBe(0);
  });

  it("should reject empty query", () => {
    const r = searchBodySchema.safeParse({ query: "" });
    expect(r.success).toBe(false);
  });
});

describe("scoringFewShotAddPostsBodySchema", () => {
  it("should accept valid post_ids", () => {
    const r = scoringFewShotAddPostsBodySchema.safeParse({
      post_ids: [POST_UUID],
    });
    expect(r.success).toBe(true);
  });

  it("should reject invalid UUID in post_ids", () => {
    const r = scoringFewShotAddPostsBodySchema.safeParse({
      post_ids: ["bad"],
    });
    expect(r.success).toBe(false);
  });
});

describe("scoringFewShotConfigSchema", () => {
  it("should accept one minimal example", () => {
    const r = scoringFewShotConfigSchema.safeParse({
      examples: [
        {
          ideal: validIdeal,
          post_id: POST_UUID,
        },
      ],
      intro: "Intro text",
    });
    expect(r.success).toBe(true);
  });

  it("should reject empty examples", () => {
    const r = scoringFewShotConfigSchema.safeParse({
      examples: [],
      intro: "x",
    });
    expect(r.success).toBe(false);
  });
});

describe("settingsPutBodySchema", () => {
  it("should accept ranking_weights only", () => {
    const r = settingsPutBodySchema.safeParse({
      ranking_weights: fullRankingWeights(),
    });
    expect(r.success).toBe(true);
  });

  it("should reject when no keys provided", () => {
    const r = settingsPutBodySchema.safeParse({});
    expect(r.success).toBe(false);
  });
});

describe("postsUsedBodySchema and postsSavedBodySchema", () => {
  it("should require boolean used", () => {
    expect(postsUsedBodySchema.safeParse({ used: true }).success).toBe(true);
    expect(postsUsedBodySchema.safeParse({}).success).toBe(false);
  });

  it("should require boolean saved", () => {
    expect(postsSavedBodySchema.safeParse({ saved: false }).success).toBe(true);
    expect(postsSavedBodySchema.safeParse({}).success).toBe(false);
  });
});

describe("recomputeScoresBodySchema", () => {
  it("should accept ranking_weights", () => {
    const r = recomputeScoresBodySchema.safeParse({
      ranking_weights: fullRankingWeights(),
    });
    expect(r.success).toBe(true);
  });

  it("should accept use_active_config true", () => {
    const r = recomputeScoresBodySchema.safeParse({
      use_active_config: true,
    });
    expect(r.success).toBe(true);
  });

  it("should reject both ranking_weights and use_active_config", () => {
    const r = recomputeScoresBodySchema.safeParse({
      ranking_weights: fullRankingWeights(),
      use_active_config: true,
    });
    expect(r.success).toBe(false);
  });

  it("should reject when neither weights nor use_active_config", () => {
    const r = recomputeScoresBodySchema.safeParse({});
    expect(r.success).toBe(false);
  });
});

describe("backfillDimensionBodySchema", () => {
  it("should accept valid dimension", () => {
    expect(
      backfillDimensionBodySchema.safeParse({ dimension: "drama" }).success
    ).toBe(true);
  });

  it("should reject unknown dimension", () => {
    expect(
      backfillDimensionBodySchema.safeParse({ dimension: "nope" }).success
    ).toBe(false);
  });
});

describe("triggerScrapeBodySchema", () => {
  it("should default feed_type to recent", () => {
    const r = triggerScrapeBodySchema.safeParse({});
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.feed_type).toBe("recent");
  });

  it("should trim empty scraper_run_id to undefined", () => {
    const r = triggerScrapeBodySchema.safeParse({ scraper_run_id: "  " });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.scraper_run_id).toBeUndefined();
  });
});

describe("permalinkQueueBodySchema", () => {
  it("should accept valid Nextdoor permalink", () => {
    const r = permalinkQueueBodySchema.safeParse({
      url: "https://nextdoor.com/p/ABC123",
    });
    expect(r.success).toBe(true);
  });

  it("should reject non-Nextdoor URL", () => {
    const r = permalinkQueueBodySchema.safeParse({
      url: "https://example.com/foo",
    });
    expect(r.success).toBe(false);
  });
});

describe("weightConfigPatchBodySchema", () => {
  it("should accept name only", () => {
    const r = weightConfigPatchBodySchema.safeParse({ name: "New name" });
    expect(r.success).toBe(true);
  });

  it("should reject when both name and description missing", () => {
    const r = weightConfigPatchBodySchema.safeParse({});
    expect(r.success).toBe(false);
  });
});

describe("postsBulkCountBodySchema and postsBulkBodySchema", () => {
  it("should parse bulk count with query", () => {
    const r = postsBulkCountBodySchema.safeParse({
      query: { sort: "score" },
    });
    expect(r.success).toBe(true);
  });

  it("should require post_ids or apply_to_query with query", () => {
    const r = postsBulkBodySchema.safeParse({
      action: "save",
      post_ids: [],
    });
    expect(r.success).toBe(false);
  });

  it("should accept apply_to_query with query", () => {
    const r = postsBulkBodySchema.safeParse({
      action: "ignore",
      apply_to_query: true,
      query: {},
    });
    expect(r.success).toBe(true);
  });
});

describe("postsQuerySchema", () => {
  it("should parse minimal raw query object", () => {
    const r = postsQuerySchema.safeParse({
      limit: "10",
    });
    expect(r.success).toBe(true);
  });

  it("should reject invalid category", () => {
    const r = postsQuerySchema.safeParse({
      categories: ["not_a_real_category"],
    });
    expect(r.success).toBe(false);
  });

  it("should reject invalid neighborhood_ids", () => {
    const r = postsQuerySchema.safeParse({
      neighborhood_ids: ["bad-id"],
    });
    expect(r.success).toBe(false);
  });

  it("should accept valid neighborhood_ids", () => {
    const r = postsQuerySchema.safeParse({
      neighborhood_ids: [NB_UUID],
    });
    expect(r.success).toBe(true);
  });

  it("should reject invalid weights JSON keys", () => {
    const r = postsQuerySchema.safeParse({
      weights: JSON.stringify({ foo: 1 }),
    });
    expect(r.success).toBe(false);
  });
});

describe("adminJobsQuerySchema", () => {
  it("should clamp limit", () => {
    const r = adminJobsQuerySchema.safeParse({ limit: "100" });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.limit).toBe(50);
  });

  it("should reject invalid id format", () => {
    const r = adminJobsQuerySchema.safeParse({ id: "not-uuid" });
    expect(r.success).toBe(false);
  });
});
