"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import { PostCard } from "./PostCard";

import type { PostWithScores } from "@/lib/types";

const DEFAULT_PICKS_MIN_SCORE = 7;
const DEFAULT_PICKS_LIMIT = 5;

/**
 * PodcastPicks component displays top-scoring posts in a highlighted section.
 * Min score and limit can be set via URL: ?picks_min=7&picks_limit=5
 */
export function PodcastPicks() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const picksMinScore = useMemo(() => {
    const v = searchParams.get("picks_min");
    const n = v != null ? parseFloat(v) : NaN;
    return Number.isFinite(n) && n >= 0 ? n : DEFAULT_PICKS_MIN_SCORE;
  }, [searchParams]);
  const picksLimit = useMemo(() => {
    const v = searchParams.get("picks_limit");
    const n = v != null ? parseInt(v, 10) : NaN;
    return Number.isFinite(n) && n >= 1 && n <= 20 ? n : DEFAULT_PICKS_LIMIT;
  }, [searchParams]);
  const [loading, setLoading] = useState(true);
  const [markingSaved, setMarkingSaved] = useState<Set<string>>(new Set());
  const [markingUsed, setMarkingUsed] = useState<Set<string>>(new Set());
  const [picks, setPicks] = useState<PostWithScores[]>([]);

  const fetchPicks = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams();
    params.set("limit", String(picksLimit));
    params.set("min_score", String(picksMinScore));
    params.set("sort", "score");
    params.set("unused_only", "true");

    return fetch(`/api/posts?${params.toString()}`)
      .then((res) => (res.ok ? res.json() : { data: [], total: 0 }))
      .then((result) => setPicks(result.data || []))
      .catch(() => setPicks([]))
      .finally(() => setLoading(false));
  }, [picksLimit, picksMinScore]);

  useEffect(() => {
    void fetchPicks();
  }, [fetchPicks]);

  const handleMarkSaved = useCallback(
    async (postId: string, saved: boolean) => {
      if (markingSaved.has(postId)) return;
      setMarkingSaved((prev) => new Set(prev).add(postId));
      try {
        const response = await fetch(`/api/posts/${postId}/saved`, {
          body: JSON.stringify({ saved }),
          headers: { "Content-Type": "application/json" },
          method: "PATCH",
        });
        if (response.ok) {
          await fetchPicks();
        }
      } finally {
        setMarkingSaved((prev) => {
          const next = new Set(prev);
          next.delete(postId);
          return next;
        });
      }
    },
    [fetchPicks, markingSaved]
  );

  const handleMarkUsed = useCallback(
    async (postId: string) => {
      if (markingUsed.has(postId)) return;
      setMarkingUsed((prev) => new Set(prev).add(postId));
      try {
        const response = await fetch(`/api/posts/${postId}/used`, {
          body: JSON.stringify({ used: true }),
          headers: { "Content-Type": "application/json" },
          method: "PATCH",
        });
        if (response.ok) {
          await fetchPicks();
        }
      } finally {
        setMarkingUsed((prev) => {
          const next = new Set(prev);
          next.delete(postId);
          return next;
        });
      }
    },
    [fetchPicks, markingUsed]
  );

  if (loading) {
    return (
      <section className="mb-8">
        <h2 className="mb-4 flex items-center gap-2 text-xl font-semibold">
          <span className="rounded bg-yellow-500/20 px-2 py-0.5 text-yellow-400">
            Podcast Picks
          </span>
        </h2>
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="animate-pulse rounded-lg border border-gray-700 bg-gray-800 p-4"
            >
              <div className="mb-2 h-4 w-1/3 rounded bg-gray-700" />
              <div className="h-20 rounded bg-gray-700" />
            </div>
          ))}
        </div>
      </section>
    );
  }

  return (
    <section className="mb-8">
      <h2 className="mb-4 flex items-center gap-2 text-xl font-semibold">
        <span className="rounded bg-yellow-500/20 px-2 py-0.5 text-yellow-400">
          Podcast Picks
        </span>
        <span className="text-sm font-normal text-gray-500">
          Top posts (score ≥ {picksMinScore})
        </span>
      </h2>
      {picks.length === 0 ? (
        <div className="rounded-lg border border-gray-700 bg-gray-800/80 p-6 text-center">
          <p className="text-gray-400">No picks in this range yet.</p>
          <p className="mt-2 text-sm text-gray-500">
            Try lowering the minimum score in the feed filters, or run the
            scraper to add more scored posts.
          </p>
        </div>
      ) : (
      <div className="space-y-4">
        {picks.map((post) => (
          <div
            key={post.id}
            className="rounded-lg border-2 border-yellow-500/30 bg-gray-800/80"
          >
            <PostCard
              isMarkingSaved={markingSaved.has(post.id)}
              isMarkingUsed={markingUsed.has(post.id)}
              post={post}
              onMarkSaved={handleMarkSaved}
              onMarkUsed={handleMarkUsed}
              onViewDetails={() => router.push(`/posts/${post.id}`)}
            />
          </div>
        ))}
      </div>
      )}
    </section>
  );
}
