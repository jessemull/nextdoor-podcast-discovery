"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { PostCard } from "@/components/PostCard";
import { Card } from "@/components/ui/Card";
import { usePermalinkJobs } from "@/lib/hooks/usePermalinkJobs";
import { useToast } from "@/lib/ToastContext";

import type { PostWithScores } from "@/lib/types";

interface PostDetailClientProps {
  initialPost: null | PostWithScores;
  postId: string;
}

export function PostDetailClient({
  initialPost,
  postId,
}: PostDetailClientProps) {
  const router = useRouter();
  const { toast } = useToast();
  const {
    getActiveJobForPost,
    getQueueStatusForPost,
    refetch: refetchPermalinkJobs,
  } = usePermalinkJobs();
  const [cancellingJobId, setCancellingJobId] = useState<null | string>(null);
  const [error, setError] = useState<null | string>(null);
  const [markingIgnored, setMarkingIgnored] = useState(false);
  const [markingSaved, setMarkingSaved] = useState(false);
  const [markingUsed, setMarkingUsed] = useState(false);
  const [post, setPost] = useState<null | PostWithScores>(initialPost);
  const [relatedLoading, setRelatedLoading] = useState(false);
  const [relatedPosts, setRelatedPosts] = useState<PostWithScores[]>([]);
  const [queuingRefresh, setQueuingRefresh] = useState(false);

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

  const fetchPost = useCallback(async () => {
    if (!postId) return;

    setError(null);

    try {
      const response = await fetch(`/api/posts/${postId}`);
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || data.details || "Failed to fetch post");
      }
      const { data } = await response.json();
      setPost(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
      setPost(null);
    }
  }, [postId]);

  // Refetch from API on mount so we always have fresh data (including score breakdown)
  useEffect(() => {
    if (!postId) return;
    void fetchPost();
  }, [postId, fetchPost]);

  useEffect(() => {
    if (!post?.text || !postId) return;

    setRelatedLoading(true);

    const query = post.text.slice(0, 500);

    fetch("/api/search", {
      body: JSON.stringify({
        limit: 6,
        query,
        similarity_threshold: 0.3,
      }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    })
      .then((res) => res.json())
      .then((result) => {
        const posts = result.data || [];
        setRelatedPosts(
          posts.filter((p: PostWithScores) => p.id !== postId).slice(0, 5)
        );
      })
      .catch(() => setRelatedPosts([]))
      .finally(() => setRelatedLoading(false));
  }, [postId, post?.text]);

  const handleMarkSaved = useCallback(
    async (saved: boolean) => {
      if (!postId || markingSaved) return;
      setMarkingSaved(true);
      try {
        const response = await fetch(`/api/posts/${postId}/saved`, {
          body: JSON.stringify({ saved }),
          headers: { "Content-Type": "application/json" },
          method: "PATCH",
        });
        if (response.ok) {
          await fetchPost();
        }
      } finally {
        setMarkingSaved(false);
      }
    },
    [postId, markingSaved, fetchPost]
  );

  const handleMarkUsed = useCallback(async () => {
    if (!postId || markingUsed) return;

    setMarkingUsed(true);
    try {
      const response = await fetch(`/api/posts/${postId}/used`, {
        body: JSON.stringify({ used: true }),
        headers: { "Content-Type": "application/json" },
        method: "PATCH",
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to mark as used");
      }

      await fetchPost();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update");
    } finally {
      setMarkingUsed(false);
    }
  }, [postId, markingUsed, fetchPost]);

  const handleMarkIgnored = useCallback(
    async (ignored: boolean) => {
      if (!postId || markingIgnored) return;
      setMarkingIgnored(true);
      try {
        const response = await fetch(`/api/posts/${postId}/ignored`, {
          body: JSON.stringify({ ignored }),
          headers: { "Content-Type": "application/json" },
          method: "PATCH",
        });
        if (response.ok) {
          await fetchPost();
        }
      } finally {
        setMarkingIgnored(false);
      }
    },
    [postId, markingIgnored, fetchPost]
  );

  const handleQueueRefresh = useCallback(async () => {
    if (!post?.url || !postId || queuingRefresh) return;
    setQueuingRefresh(true);
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
      setQueuingRefresh(false);
    }
  }, [post?.url, postId, queuingRefresh, refetchPermalinkJobs, toast]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }
      if (e.key === "j" || e.key === "J") {
        e.preventDefault();
        router.back();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [router]);

  if (error || !post) {
    return (
      <main className="min-h-screen p-8">
        <div className="mx-auto max-w-4xl">
          <Card className="border-destructive bg-destructive/10">
            <p className="text-destructive">{error || "Post not found"}</p>
            <Link
              className="mt-4 inline-flex items-center gap-2 text-muted hover:text-foreground"
              href="/feed"
            >
              <ArrowLeft aria-hidden className="h-4 w-4" />
              Back to Feed
            </Link>
          </Card>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen p-8">
      <div className="mx-auto max-w-4xl">
        {/* Back link */}
        <Link
          className="mb-6 inline-flex items-center gap-2 text-muted text-sm hover:text-foreground"
          href="/feed"
        >
          <ArrowLeft aria-hidden className="h-4 w-4" />
          Back to Feed
        </Link>

        {/* Post card (same as feed, with score breakdown and full text expanded) */}
        <div className="mb-8">
          <PostCard
            activeJobId={getActiveJobForPost(post)?.id ?? null}
            defaultExpanded
            isMarkingIgnored={markingIgnored}
            isMarkingSaved={markingSaved}
            isMarkingUsed={markingUsed}
            isCancellingRefresh={
              cancellingJobId === getActiveJobForPost(post)?.id
            }
            isQueuingRefresh={queuingRefresh}
            post={post}
            queueStatus={getQueueStatusForPost(post)}
            showScoreBreakdown
            onCancelRefresh={handleCancelRefresh}
            onMarkIgnored={(_postId, ignored) => handleMarkIgnored(ignored)}
            onMarkSaved={(_postId, saved) => handleMarkSaved(saved)}
            onMarkUsed={handleMarkUsed}
            onQueueRefresh={handleQueueRefresh}
          />
        </div>

        {/* Related posts */}
        <section>
          <h3 className="mb-4 text-foreground text-lg font-semibold">
            Related posts
          </h3>
          {relatedLoading ? (
            <div className="flex justify-center py-8">
              <div
                aria-hidden
                className="border-border-focus h-8 w-8 animate-spin rounded-full border-2 border-t-transparent"
              />
            </div>
          ) : relatedPosts.length > 0 ? (
            <div className="space-y-4">
              {relatedPosts.map((relatedPost) => (
                <PostCard
                  key={relatedPost.id}
                  post={relatedPost}
                  onViewDetails={() =>
                    router.push(`/posts/${relatedPost.id}`)
                  }
                />
              ))}
            </div>
          ) : (
            <p className="text-muted">No related posts found.</p>
          )}
        </section>

        <p className="text-muted-foreground mt-6 text-xs">
          Press{" "}
          <kbd className="rounded border border-border bg-surface-hover px-1">
            J
          </kbd>{" "}
          to go back
        </p>
      </div>
    </main>
  );
}
