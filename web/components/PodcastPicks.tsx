"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import { Card } from "@/components/ui/Card";
import { usePermalinkJobs } from "@/lib/hooks/usePermalinkJobs";
import { useToast } from "@/lib/ToastContext";

import { PostCard } from "./PostCard";

import type { PostWithScores } from "@/lib/types";

const FALLBACK_PICKS_MIN_SCORE = 7;
const PICKS_LIMIT = 20;

/**
 * PodcastPicks component displays top-scoring posts in a highlighted section.
 * Min score from Settings (picks_defaults), overridden by URL: ?picks_min=7
 */
export function PodcastPicks() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [picksDefaults, setPicksDefaults] = useState<{
    picks_min: number;
  } | null>(null);

  useEffect(() => {
    fetch("/api/settings")
      .then((res) => (res.ok ? res.json() : { data: {} }))
      .then((json) => {
        const pd = json.data?.picks_defaults;
        if (pd && typeof pd.picks_min === "number") {
          setPicksDefaults({
            picks_min: Math.min(10, Math.max(0, pd.picks_min)),
          });
        } else {
          setPicksDefaults({ picks_min: FALLBACK_PICKS_MIN_SCORE });
        }
      })
      .catch(() =>
        setPicksDefaults({ picks_min: FALLBACK_PICKS_MIN_SCORE })
      );
  }, []);

  const defaultMinScore = picksDefaults?.picks_min ?? FALLBACK_PICKS_MIN_SCORE;

  const picksMinScore = useMemo(() => {
    const v = searchParams.get("picks_min");
    const n = v != null ? parseFloat(v) : NaN;
    return Number.isFinite(n) && n >= 0 ? n : defaultMinScore;
  }, [searchParams, defaultMinScore]);
  const { toast } = useToast();
  const {
    getActiveJobForPost,
    getQueueStatusForPost,
    refetch: refetchPermalinkJobs,
  } = usePermalinkJobs();
  const [cancellingJobId, setCancellingJobId] = useState<null | string>(null);
  const [loading, setLoading] = useState(true);
  const [markingSaved, setMarkingSaved] = useState<Set<string>>(new Set());
  const [markingUsed, setMarkingUsed] = useState<Set<string>>(new Set());
  const [picks, setPicks] = useState<PostWithScores[]>([]);
  const [queuingRefreshPostId, setQueuingRefreshPostId] = useState<null | string>(null);

  const handleCancelRefresh = useCallback(
    async (jobId: string) => {
      if (cancellingJobId != null) return;
      setCancellingJobId(jobId);
      try {
        const response = await fetch(`/api/admin/jobs/${jobId}`, {
          method: "DELETE",
        });
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error || data.details || "Failed to remove");
        }
        await refetchPermalinkJobs();
        toast.success("Removed from queue.");
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Failed to remove from queue"
        );
      } finally {
        setCancellingJobId(null);
      }
    },
    [cancellingJobId, refetchPermalinkJobs, toast]
  );

  const fetchPicks = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams();
    params.set("limit", String(PICKS_LIMIT));
    params.set("min_score", String(picksMinScore));
    params.set("sort", "score");
    params.set("unused_only", "true");

    return fetch(`/api/posts?${params.toString()}`)
      .then((res) => (res.ok ? res.json() : { data: [], total: 0 }))
      .then((result) => setPicks(result.data || []))
      .catch(() => setPicks([]))
      .finally(() => setLoading(false));
  }, [picksMinScore]);

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

  const handleQueueRefresh = useCallback(
    async (postId: string) => {
      const post = picks.find((p) => p.id === postId);
      if (!post?.url || queuingRefreshPostId != null) return;
      setQueuingRefreshPostId(postId);
      try {
        const response = await fetch("/api/admin/permalink-queue", {
          body: JSON.stringify({ post_id: postId, url: post.url }),
          headers: { "Content-Type": "application/json" },
          method: "POST",
        });
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error || data.details || "Failed to queue refresh");
        }
        toast.success("Added to queue successfully.");
        refetchPermalinkJobs();
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Failed to queue refresh"
        );
      } finally {
        setQueuingRefreshPostId(null);
      }
    },
    [picks, queuingRefreshPostId, refetchPermalinkJobs, toast]
  );

  if (loading) {
    return (
      <section className="mb-8">
        <h2 className="mb-4 text-foreground text-lg font-semibold">
          Podcast Picks
        </h2>
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse">
              <div className="mb-2 h-4 w-1/3 rounded bg-surface-hover" />
              <div className="h-20 rounded bg-surface-hover" />
            </Card>
          ))}
        </div>
      </section>
    );
  }

  return (
    <section className="mb-8">
      <h2 className="mb-4 text-foreground text-lg font-semibold">
        Podcast Picks
      </h2>
      <p className="text-muted-foreground mb-2 text-sm">
        Top posts (score ≥ {picksMinScore})
      </p>
      {picks.length === 0 ? (
        <Card className="py-6 text-center">
          <p className="text-muted">No picks in this range yet.</p>
          <p className="text-muted-foreground mt-2 text-sm">
            Try lowering the minimum score in the feed filters, or run the
            scraper to add more scored posts.
          </p>
        </Card>
      ) : (
        <div className="space-y-4">
          {picks.map((post) => (
            <PostCard
              key={post.id}
              activeJobId={getActiveJobForPost(post)?.id ?? null}
              isCancellingRefresh={
                cancellingJobId === getActiveJobForPost(post)?.id
              }
              isMarkingSaved={markingSaved.has(post.id)}
              isMarkingUsed={markingUsed.has(post.id)}
              isQueuingRefresh={queuingRefreshPostId === post.id}
              post={post}
              queueStatus={getQueueStatusForPost(post)}
              onCancelRefresh={handleCancelRefresh}
              onMarkSaved={handleMarkSaved}
              onMarkUsed={handleMarkUsed}
              onQueueRefresh={handleQueueRefresh}
              onViewDetails={() => router.push(`/posts/${post.id}`)}
            />
          ))}
        </div>
      )}
    </section>
  );
}
