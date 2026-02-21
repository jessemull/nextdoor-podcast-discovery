import type { RankingWeights } from "@/lib/types";

/**
 * Shared constants used across the application.
 */

/** Default ranking weights for feed preview mode (matches Settings default). */
export const DEFAULT_PREVIEW_WEIGHTS: RankingWeights = {
  absurdity: 2.5,
  discussion_spark: 1.0,
  drama: 1.5,
  emotional_intensity: 1.2,
  news_value: 1.0,
  podcast_worthy: 2.5,
  readability: 1.2,
};

/**
 * Valid topic categories for post filtering.
 * These must match the categories used in the LLM scorer.
 */
export const TOPIC_CATEGORIES = [
  "crime",
  "drama",
  "humor",
  "local_news",
  "lost_pet",
  "noise",
  "suspicious",
  "wildlife",
] as const;

export type TopicCategory = (typeof TOPIC_CATEGORIES)[number];

/**
 * Default debounce delay for filter inputs (in milliseconds).
 * Used to prevent excessive API calls while user is typing.
 */
export const DEBOUNCE_DELAY_MS = 500;

/**
 * Default search suggestions for autocomplete (alphabetically sorted).
 */
export const SEARCH_SUGGESTIONS = [
  "coyote",
  "HOA",
  "lost cat",
  "lost dog",
  "noisy neighbors",
  "package stolen",
  "suspicious",
  "wildlife",
] as const;
