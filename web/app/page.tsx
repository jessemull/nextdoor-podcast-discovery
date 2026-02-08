import { Suspense } from "react";

import { ActiveConfigBadge } from "@/components/ActiveConfigBadge";
import { PodcastPicks } from "@/components/PodcastPicks";
import { PostFeed } from "@/components/PostFeed";
import { SportsFact } from "@/components/SportsFact";
import { StatsPanel } from "@/components/StatsPanel";

export default function Home() {
  return (
    <main className="min-h-screen p-8">
      <div className="max-w-5xl mx-auto">
        <h1 className="text-4xl font-bold mb-4">
          Nextdoor Podcast Discovery
        </h1>
        <p className="text-lg text-gray-400 mb-8">
          Discover and curate interesting Nextdoor posts for your podcast.
        </p>
        {/* Sports fact banner for Matt */}
        <SportsFact />
        {/* Stats panel */}
        <div className="mb-6">
          <StatsPanel />
        </div>
        {/* Podcast Picks - top-scoring unused posts (uses useSearchParams) */}
        <Suspense fallback={<div className="h-32 animate-pulse rounded-lg bg-gray-800" />}>
          <PodcastPicks />
        </Suspense>
        {/* Post feed + quick filters */}
        <section aria-label="Feed">
          <div className="mb-4 flex items-center gap-2">
            <h2 className="text-xl font-semibold">Feed</h2>
            <ActiveConfigBadge />
          </div>
          <PostFeed />
        </section>
      </div>
    </main>
  );
}
