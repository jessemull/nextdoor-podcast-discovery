/**
 * Zod schemas for API request body validation.
 * Use at API boundaries so invalid input is rejected with clear 400 responses.
 */

import { z } from "zod";

const VALID_WEIGHT_DIMENSIONS = [
  "absurdity",
  "drama",
  "discussion_spark",
  "emotional_intensity",
  "news_value",
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

/** PUT /api/settings body (at least one key required) */
export const settingsPutBodySchema = z
  .object({
    ranking_weights: rankingWeightsSchema.optional(),
    search_defaults: z
      .object({
        similarity_threshold: z.number().min(0).max(1).optional(),
      })
      .optional(),
  })
  .refine(
    (data) => data.ranking_weights !== undefined || data.search_defaults !== undefined,
    "At least one of ranking_weights or search_defaults must be provided"
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
