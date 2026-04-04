import type { PostWithScores } from "@/lib/types";

export interface PostFeedSearchSlotProps {
  debouncedQuery: string;
  embeddingBacklog: number;
  loadDefaultsError: null | string;
  loading: boolean;
  markingSaved: Set<string>;
  onMarkSaved: (postId: string, saved: boolean) => void;
  onMarkUsedChange: (postId: string, used: boolean) => void;
  onQueryChange: (value: string) => void;
  onResetAll?: () => void;
  onSearch: (queryOverride?: string) => void;
  onSimilarityThresholdChange: (value: number) => void;
  onUseKeywordSearchChange: (value: boolean) => void;
  onViewDetails: (postId: string) => void;
  query: string;
  results: PostWithScores[];
  searchError: null | string;
  searchTotal: number;
  similarityThreshold: number;
  useKeywordSearch: boolean;
}

export interface PicksDefaultsForFeed {
  picks_min: number;
}
