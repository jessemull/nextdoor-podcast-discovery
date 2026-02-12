import { Suspense } from "react";

import { ActiveConfigBadge } from "@/components/ActiveConfigBadge";
import { PodcastPicks } from "@/components/PodcastPicks";
import { PostFeed } from "@/components/PostFeed";

export default function FeedPage() {
  return (
    <main className="min-h-screen p-8">
      <div className="mx-auto max-w-5xl">
        {/* Podcast Picks - top-scoring unused posts (uses useSearchParams) */}
        <Suspense
          fallback={
            <div className="h-32 animate-pulse rounded-card bg-surface" />
          }
        >
          <PodcastPicks />
        </Suspense>
        {/* Post feed + quick filters */}
        <section aria-label="Feed">
          <div className="mb-4 flex items-center gap-2">
            <h2 className="text-foreground text-lg font-semibold">Feed</h2>
            <ActiveConfigBadge />
          </div>
          <PostFeed />
        </section>
      </div>
    </main>
  );
}
