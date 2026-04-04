"use client";

import { PostFeedLayout } from "./post-feed/PostFeedLayout";
import { usePostFeedModel } from "./post-feed/usePostFeedModel";

import type { PicksDefaultsForFeed, PostFeedSearchSlotProps } from "./post-feed/post-feed-types";

export type { PicksDefaultsForFeed, PostFeedSearchSlotProps };

/**
 * PostFeed displays a list of Nextdoor posts with filtering and infinite scroll.
 * Layout: side panel (filters) + main (optional search bar, then sort/chips/feed or search results).
 * When searchSlot is provided, the search bar is the first element in the main column; search results or feed follow.
 */
export function PostFeed({
  initialCategoryIds,
  picksDefaults = null,
  searchSlot = null,
  postType = "standard",
}: {
  initialCategoryIds?: string[];
  picksDefaults?: null | PicksDefaultsForFeed;
  searchSlot?: null | PostFeedSearchSlotProps;
  postType?: "classified" | "standard";
} = {}) {
  const model = usePostFeedModel({
    initialCategoryIds,
    picksDefaults,
    postType,
    searchSlot,
  });
  return <PostFeedLayout model={model} />;
}
