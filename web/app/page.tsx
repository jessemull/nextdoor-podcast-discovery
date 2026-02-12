import { Suspense } from "react";

import { ActiveConfigBadge } from "@/components/ActiveConfigBadge";
import { PodcastPicks } from "@/components/PodcastPicks";
import { PostFeed } from "@/components/PostFeed";
import { SportsFact } from "@/components/SportsFact";
import { StatsPanel } from "@/components/StatsPanel";

export default function Home() {
  return (
    <main className="min-h-screen p-8">
      <div className="mx-auto max-w-5xl">
        <h1 className="mb-2 text-2xl font-semibold text-foreground">
          Nextdoor Podcast Discovery
        </h1>
        <p className="mb-8 text-muted text-sm">
          Discover and curate interesting Nextdoor posts for your podcast.
        </p>
        {/* Sports fact banner for Matt */}
        <SportsFact />
        {/* Stats panel */}
        <div className="mb-6">
          <StatsPanel />
        </div>
        {/* Podcast Picks - top-scoring unused posts (uses useSearchParams) */}
        <Suspense fallback={<div className="h-32 animate-pulse rounded-card bg-surface" />}>
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
