"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import { PostCard } from "./PostCard";

import type { PostWithScores } from "@/lib/types";

const FALLBACK_PICKS_MIN_SCORE = 7;
const FALLBACK_PICKS_LIMIT = 5;

/**
 * PodcastPicks component displays top-scoring posts in a highlighted section.
 * Min score and limit from Settings (picks_defaults), overridden by URL: ?picks_min=7&picks_limit=5
 */
export function PodcastPicks() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [picksDefaults, setPicksDefaults] = useState<{
    picks_limit: number;
    picks_min: number;
    picks_min_podcast?: number;
  } | null>(null);

  useEffect(() => {
    fetch("/api/settings")
      .then((res) => (res.ok ? res.json() : { data: {} }))
      .then((json) => {
        const pd = json.data?.picks_defaults;
        if (pd && typeof pd.picks_min === "number" && typeof pd.picks_limit === "number") {
          setPicksDefaults({
            picks_limit: Math.min(20, Math.max(1, pd.picks_limit)),
            picks_min: Math.min(10, Math.max(0, pd.picks_min)),
            picks_min_podcast:
              typeof pd.picks_min_podcast === "number" &&
              pd.picks_min_podcast >= 0 &&
              pd.picks_min_podcast <= 10
                ? pd.picks_min_podcast
                : undefined,
          });
        } else {
          setPicksDefaults({
            picks_limit: FALLBACK_PICKS_LIMIT,
            picks_min: FALLBACK_PICKS_MIN_SCORE,
          });
        }
      })
      .catch(() =>
        setPicksDefaults({
          picks_limit: FALLBACK_PICKS_LIMIT,
          picks_min: FALLBACK_PICKS_MIN_SCORE,
        })
      );
  }, []);

  const defaultMinScore = picksDefaults?.picks_min ?? FALLBACK_PICKS_MIN_SCORE;
  const defaultLimit = picksDefaults?.picks_limit ?? FALLBACK_PICKS_LIMIT;
  const defaultMinPodcast =
    picksDefaults?.picks_min_podcast != null ? picksDefaults.picks_min_podcast : null;

  const picksMinScore = useMemo(() => {
    const v = searchParams.get("picks_min");
    const n = v != null ? parseFloat(v) : NaN;
    return Number.isFinite(n) && n >= 0 ? n : defaultMinScore;
  }, [searchParams, defaultMinScore]);
  const picksLimit = useMemo(() => {
    const v = searchParams.get("picks_limit");
    const n = v != null ? parseInt(v, 10) : NaN;
    return Number.isFinite(n) && n >= 1 && n <= 20 ? n : defaultLimit;
  }, [searchParams, defaultLimit]);
  const picksMinPodcast = useMemo(() => {
    const v = searchParams.get("picks_min_podcast");
    const n = v != null ? parseFloat(v) : NaN;
    if (Number.isFinite(n) && n >= 0 && n <= 10) return n;
    return defaultMinPodcast;
  }, [searchParams, defaultMinPodcast]);
  const [loading, setLoading] = useState(true);
  const [markingSaved, setMarkingSaved] = useState<Set<string>>(new Set());
  const [markingUsed, setMarkingUsed] = useState<Set<string>>(new Set());
  const [picks, setPicks] = useState<PostWithScores[]>([]);

  const fetchPicks = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams();
    params.set("limit", String(picksLimit));
    params.set("min_score", String(picksMinScore));
    params.set("sort", picksMinPodcast != null ? "podcast_score" : "score");
    params.set("unused_only", "true");
    if (picksMinPodcast != null) {
      params.set("min_podcast_worthy", String(picksMinPodcast));
    }

    return fetch(`/api/posts?${params.toString()}`)
      .then((res) => (res.ok ? res.json() : { data: [], total: 0 }))
      .then((result) => setPicks(result.data || []))
      .catch(() => setPicks([]))
      .finally(() => setLoading(false));
  }, [picksLimit, picksMinPodcast, picksMinScore]);

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
          {picksMinPodcast != null
            ? `Top posts (podcast ≥ ${picksMinPodcast})`
            : `Top posts (score ≥ ${picksMinScore})`}
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
