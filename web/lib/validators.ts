/**
 * Zod schemas for API request body validation.
 * Use at API boundaries so invalid input is rejected with clear 400 responses.
 */

import { z } from "zod";

/** UUID v4 format (shared for route param validation). */
export const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const VALID_WEIGHT_DIMENSIONS = [
  "absurdity",
  "discussion_spark",
  "drama",
  "emotional_intensity",
  "news_value",
  "podcast_worthy",
  "readability",
] as const;

const weightDimensionSchema = z.enum(VALID_WEIGHT_DIMENSIONS);

const rankingWeightsSchema = z
  .record(weightDimensionSchema, z.number().min(0).max(10))
  .refine(
    (obj) => VALID_WEIGHT_DIMENSIONS.every((dim) => dim in obj),
    "Missing required weight dimensions"
  );

/** Max query length for search (prevents expensive embedding calls). */
const MAX_QUERY_LENGTH = 1000;

/** GET /api/search query params. Keyword (full-text) search. */
export const searchQuerySchema = z.object({
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .optional()
    .default(20)
    .transform((n) => Math.min(50, Math.max(1, n))),
  q: z
    .string()
    .trim()
    .min(1, "Query parameter 'q' is required and must be non-empty")
    .max(MAX_QUERY_LENGTH, `Query too long (max ${MAX_QUERY_LENGTH} characters)`),
});

export type SearchQuery = z.infer<typeof searchQuerySchema>;

/** POST /api/search body. Limit and threshold are clamped to allowed range. */
export const searchBodySchema = z.object({
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .optional()
    .default(10)
    .transform((n) => Math.min(50, Math.max(1, n))),
  min_score: z.coerce.number().min(0).max(10).optional(),
  query: z
    .string()
    .trim()
    .min(1, "Query is required and must be a non-empty string")
    .max(MAX_QUERY_LENGTH, `Query too long (max ${MAX_QUERY_LENGTH} characters)`),
  similarity_threshold: z.coerce
    .number()
    .min(0)
    .max(2)
    .optional()
    .default(0.5)
    .transform((t) => Math.max(0, Math.min(1, t))),
});

export type SearchBody = z.infer<typeof searchBodySchema>;

const noveltyConfigSchema = z.object({
  frequency_thresholds: z
    .object({
      common: z.number().int().min(1).max(500),
      rare: z.number().int().min(0).max(100),
      very_common: z.number().int().min(10).max(1000),
    })
    .optional(),
  max_multiplier: z.number().min(1).max(2).optional(),
  min_multiplier: z.number().min(0.1).max(1).optional(),
  window_days: z.number().int().min(1).max(90).optional(),
});

/** PUT /api/settings body (at least one key required) */
export const settingsPutBodySchema = z
  .object({
    novelty_config: noveltyConfigSchema.optional(),
    picks_defaults: z
      .object({
        picks_limit: z.number().int().min(1).max(20).optional(),
        picks_min: z.number().min(0).max(10).optional(),
        picks_min_podcast: z.number().min(0).max(10).optional(),
      })
      .optional(),
    ranking_weights: rankingWeightsSchema.optional(),
    search_defaults: z
      .object({
        similarity_threshold: z.number().min(0).max(1).optional(),
      })
      .optional(),
  })
  .refine(
    (data) =>
      data.ranking_weights !== undefined ||
      data.search_defaults !== undefined ||
      data.novelty_config !== undefined ||
      data.picks_defaults !== undefined,
    "At least one of ranking_weights, search_defaults, novelty_config, or picks_defaults must be provided"
  );

export type SettingsPutBody = z.infer<typeof settingsPutBodySchema>;

/** PATCH /api/posts/[id]/used body */
export const postsUsedBodySchema = z.object({
  used: z.boolean({ required_error: "Missing required field: used (boolean)" }),
});

export type PostsUsedBody = z.infer<typeof postsUsedBodySchema>;

/** PATCH /api/posts/[id]/saved body */
export const postsSavedBodySchema = z.object({
  saved: z.boolean({ required_error: "Missing required field: saved (boolean)" }),
});

export type PostsSavedBody = z.infer<typeof postsSavedBodySchema>;

/** PATCH /api/posts/[id]/ignored body */
export const postsIgnoredBodySchema = z.object({
  ignored: z.boolean({
    required_error: "Missing required field: ignored (boolean)",
  }),
});

export type PostsIgnoredBody = z.infer<typeof postsIgnoredBodySchema>;

/** POST /api/admin/recompute-scores body */
export const recomputeScoresBodySchema = z
  .object({
    description: z.string().optional(),
    name: z.string().optional(),
    ranking_weights: rankingWeightsSchema.optional(),
    use_active_config: z.literal(true).optional(),
  })
  .refine(
    (data) =>
      data.ranking_weights != null || data.use_active_config === true,
    "Provide ranking_weights or use_active_config: true"
  )
  .refine(
    (data) =>
      data.ranking_weights == null || data.use_active_config !== true,
    "Provide ranking_weights or use_active_config, not both"
  );

export type RecomputeScoresBody = z.infer<typeof recomputeScoresBodySchema>;

/** Nextdoor permalink URL pattern (e.g. https://nextdoor.com/p/ABC123) */
const NEXTDOOR_PERMALINK_REGEX =
  /^https:\/\/(?:www\.)?nextdoor\.com\/p\/[A-Za-z0-9]+(?:\/)?(?:\?.*)?$/;

/** POST /api/admin/permalink-queue body */
export const permalinkQueueBodySchema = z.object({
  post_id: z
    .string()
    .regex(UUID_REGEX, "post_id must be a valid UUID")
    .optional(),
  url: z
    .string()
    .trim()
    .url("url must be a valid URL")
    .refine(
      (val) => NEXTDOOR_PERMALINK_REGEX.test(val),
      "url must be a Nextdoor permalink (e.g. https://nextdoor.com/p/ABC123)"
    ),
});

export type PermalinkQueueBody = z.infer<typeof permalinkQueueBodySchema>;

/** PATCH /api/admin/weight-configs/:id body (name and/or description) */
export const weightConfigPatchBodySchema = z
  .object({
    description: z
      .string()
      .max(2000, "Description too long")
      .optional()
      .transform((v) =>
        v !== undefined && v.trim() === "" ? undefined : v
      ),
    name: z
      .string()
      .max(255, "Name too long")
      .optional()
      .transform((v) =>
        v !== undefined && v.trim() === "" ? undefined : v
      ),
  })
  .refine(
    (data) => data.name !== undefined || data.description !== undefined,
    "At least one of name or description is required"
  );

export type WeightConfigPatchBody = z.infer<typeof weightConfigPatchBodySchema>;

/** GET /api/posts query params. Validates at API boundary for safe parsing. */
export const postsQuerySchema = z.object({
  category: z.string().optional(),
  ignored_only: z
    .string()
    .optional()
    .transform((v) => v === "true"),
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .optional()
    .default(20)
    .transform((n) => Math.min(100, Math.max(1, n))),
  min_podcast_worthy: z.coerce.number().min(0).max(10).optional(),
  min_reaction_count: z.coerce.number().int().min(0).optional(),
  min_score: z.coerce.number().min(0).optional(),
  neighborhood_id: z
    .string()
    .optional()
    .transform((v) => (v && v.trim() ? v : undefined))
    .refine((v) => !v || UUID_REGEX.test(v), "Invalid neighborhood ID"),
  offset: z.coerce
    .number()
    .int()
    .min(0)
    .optional()
    .default(0),
  order: z.enum(["asc", "desc"]).optional().default("desc"),
  preview: z
    .string()
    .optional()
    .transform((v) => v === "true"),
  saved_only: z
    .string()
    .optional()
    .transform((v) => v === "true"),
  sort: z
    .enum(["date", "podcast_score", "score"])
    .optional()
    .default("score"),
  unused_only: z
    .string()
    .optional()
    .transform((v) => v === "true"),
  weight_config_id: z
    .string()
    .optional()
    .transform((v) => (v && v.trim() ? v : undefined))
    .refine((v) => !v || UUID_REGEX.test(v), "Invalid weight_config_id"),
  weights: z
    .string()
    .optional()
    .transform((v) => {
      if (!v || !v.trim()) return undefined;
      try {
        const parsed = JSON.parse(v) as unknown;
        if (
          parsed != null &&
          typeof parsed === "object" &&
          !Array.isArray(parsed)
        ) {
          return parsed as Record<string, number>;
        }
        return undefined;
      } catch {
        return undefined;
      }
    })
    .refine(
      (v) =>
        v === undefined ||
        (VALID_WEIGHT_DIMENSIONS.every(
          (dim) =>
            typeof v[dim] === "number" &&
            v[dim] >= 0 &&
            v[dim] <= 10
        ) &&
          Object.keys(v).every((k) =>
            VALID_WEIGHT_DIMENSIONS.includes(k as (typeof VALID_WEIGHT_DIMENSIONS)[number])
          )),
      "Invalid weights format"
    ),
});

export type PostsQuery = z.infer<typeof postsQuerySchema>;

/** POST /api/posts/bulk body: query object (for apply_to_query). Same filters as GET /api/posts. */
export const postsBulkQuerySchema = z.object({
  category: z.string().optional(),
  ignored_only: z.boolean().optional(),
  min_podcast_worthy: z.number().min(0).max(10).optional(),
  min_reaction_count: z.number().int().min(0).optional(),
  min_score: z.number().min(0).optional(),
  neighborhood_id: z
    .string()
    .optional()
    .refine((v) => !v || v.trim() === "" || UUID_REGEX.test(v), "Invalid neighborhood ID"),
  order: z.enum(["asc", "desc"]).optional(),
  saved_only: z.boolean().optional(),
  sort: z.enum(["date", "podcast_score", "score"]).optional(),
  unused_only: z.boolean().optional(),
});

/** POST /api/posts/bulk/count body. */
export const postsBulkCountBodySchema = z.object({
  query: postsBulkQuerySchema,
});

export type PostsBulkCountBody = z.infer<typeof postsBulkCountBodySchema>;

/** POST /api/posts/bulk body. Either post_ids or (apply_to_query and query). */
export const postsBulkBodySchema = z
  .object({
    action: z.enum(["ignore", "mark_used", "save", "unignore"]),
    apply_to_query: z.boolean().optional(),
    post_ids: z.array(z.string().regex(UUID_REGEX)).optional(),
    query: postsBulkQuerySchema.optional(),
  })
  .refine(
    (data) =>
      (data.post_ids != null && data.post_ids.length > 0) ||
      (data.apply_to_query === true && data.query != null),
    "Provide either non-empty post_ids or apply_to_query true with query"
  );

export type PostsBulkBody = z.infer<typeof postsBulkBodySchema>;

/** GET /api/admin/jobs query params. */
export const adminJobsQuerySchema = z.object({
  id: z
    .string()
    .optional()
    .refine((v) => !v || UUID_REGEX.test(v), "Invalid job ID format"),
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .optional()
    .default(10)
    .transform((n) => Math.min(50, Math.max(1, n))),
  type: z
    .enum(["fetch_permalink", "recompute_final_scores"])
    .optional(),
});

export type AdminJobsQuery = z.infer<typeof adminJobsQuerySchema>;
