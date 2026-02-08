"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { PostCard } from "./PostCard";

import type { PostWithScores } from "@/lib/types";

/** Minimum score for a post to be considered a "Podcast Pick" */
const PICKS_MIN_SCORE = 7;
const PICKS_LIMIT = 5;

/**
 * PodcastPicks component displays top-scoring posts in a highlighted section.
 */
export function PodcastPicks() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [markingSaved, setMarkingSaved] = useState<Set<string>>(new Set());
  const [markingUsed, setMarkingUsed] = useState<Set<string>>(new Set());
  const [picks, setPicks] = useState<PostWithScores[]>([]);

  const fetchPicks = useCallback(() => {
    const params = new URLSearchParams();
    params.set("limit", String(PICKS_LIMIT));
    params.set("min_score", String(PICKS_MIN_SCORE));
    params.set("sort", "score");
    params.set("unused_only", "true");

    return fetch(`/api/posts?${params.toString()}`)
      .then((res) => (res.ok ? res.json() : { data: [], total: 0 }))
      .then((result) => setPicks(result.data || []))
      .catch(() => setPicks([]))
      .finally(() => setLoading(false));
  }, []);

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

  if (loading || picks.length === 0) return null;

  return (
    <section className="mb-8">
      <h2 className="mb-4 flex items-center gap-2 text-xl font-semibold">
        <span className="rounded bg-yellow-500/20 px-2 py-0.5 text-yellow-400">
          Podcast Picks
        </span>
        <span className="text-sm font-normal text-gray-500">
          Top posts (score ≥ {PICKS_MIN_SCORE})
        </span>
      </h2>
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
    </section>
  );
}
