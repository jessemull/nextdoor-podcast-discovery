import type { DimensionScores } from "@/lib/types";

export const POST_CARD_DIMENSION_LABELS: Record<keyof DimensionScores, string> = {
  absurdity: "Absurdity",
  discussion_spark: "Discussion",
  drama: "Drama",
  emotional_intensity: "Intensity",
  news_value: "News",
  podcast_worthy: "Podcast",
  readability: "Readability",
};
