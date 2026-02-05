/**
 * Shared constants used across the application.
 */

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
