/**
 * Zod schemas for API request body validation.
 * Use at API boundaries so invalid input is rejected with clear 400 responses.
 */

import { z } from "zod";

/** UUID v4 format (shared for route param validation). */
export const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const VALID_WEIGHT_DIMENSIONS = [
  "absurdity",
  "discussion_spark",
  "drama",
  "emotional_intensity",
  "news_value",
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
      data.novelty_config !== undefined,
    "At least one of ranking_weights, search_defaults, or novelty_config must be provided"
  );

export type SettingsPutBody = z.infer<typeof settingsPutBodySchema>;

/** PATCH /api/posts/[id]/used body */
export const postsUsedBodySchema = z.object({
  episode_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid episode_date format (expected YYYY-MM-DD)")
    .optional(),
  used: z.boolean({ required_error: "Missing required field: used (boolean)" }),
});

export type PostsUsedBody = z.infer<typeof postsUsedBodySchema>;

/** POST /api/admin/recompute-scores body */
export const recomputeScoresBodySchema = z.object({
  description: z.string().optional(),
  name: z.string().optional(),
  ranking_weights: rankingWeightsSchema,
});

export type RecomputeScoresBody = z.infer<typeof recomputeScoresBodySchema>;

/** GET /api/posts query params. Validates at API boundary for safe parsing. */
export const postsQuerySchema = z.object({
  category: z.string().optional(),
  episode_date: z
    .string()
    .optional()
    .refine((v) => !v || /^\d{4}-\d{2}-\d{2}$/.test(v), "Invalid episode_date (YYYY-MM-DD)"),
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .optional()
    .default(20)
    .transform((n) => Math.min(100, Math.max(1, n))),
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
  saved_only: z
    .string()
    .optional()
    .transform((v) => v === "true"),
  sort: z
    .enum(["date", "score"])
    .optional()
    .default("score"),
  unused_only: z
    .string()
    .optional()
    .transform((v) => v === "true"),
});

export type PostsQuery = z.infer<typeof postsQuerySchema>;

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
    .enum(["recompute_final_scores"])
    .optional(),
});

export type AdminJobsQuery = z.infer<typeof adminJobsQuerySchema>;
