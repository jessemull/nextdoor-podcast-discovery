"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { PostCard } from "@/components/PostCard";
import { cn, formatRelativeTime } from "@/lib/utils";

import type { PostWithScores } from "@/lib/types";

const DIMENSION_LABELS: Record<string, string> = {
  absurdity: "Absurdity",
  discussion_spark: "Discussion",
  drama: "Drama",
  emotional_intensity: "Intensity",
  news_value: "News",
  podcast_worthy: "Podcast",
  readability: "Readability",
};

interface PostDetailClientProps {
  initialPost: null | PostWithScores;
  postId: string;
}

export function PostDetailClient({
  initialPost,
  postId,
}: PostDetailClientProps) {
  const router = useRouter();
  const [error, setError] = useState<null | string>(null);
  const [markingIgnored, setMarkingIgnored] = useState(false);
  const [markingSaved, setMarkingSaved] = useState(false);
  const [markingUsed, setMarkingUsed] = useState(false);
  const [post, setPost] = useState<null | PostWithScores>(initialPost);
  const [relatedPosts, setRelatedPosts] = useState<PostWithScores[]>([]);
  const [relatedLoading, setRelatedLoading] = useState(false);

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

  // Fetch related posts via semantic search (post text as query)
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
        setRelatedPosts(posts.filter((p: PostWithScores) => p.id !== postId).slice(0, 5));
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

  // Keyboard shortcuts: J = previous (back)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
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
        <div className="mx-auto max-w-3xl">
          <div className="rounded-lg border border-red-800 bg-red-900/20 p-6">
            <p className="text-red-400">{error || "Post not found"}</p>
            <Link className="mt-4 inline-block text-blue-400 hover:text-blue-300" href="/">
              Back to Feed
            </Link>
          </div>
        </div>
      </main>
    );
  }

  const scores = post.llm_scores;
  const dimensionScores = scores?.scores;

  return (
    <main className="min-h-screen p-8">
      <div className="mx-auto max-w-3xl">
        {/* Back link */}
        <Link
          className="mb-6 inline-block text-sm text-gray-400 hover:text-white"
          href="/"
        >
          ← Back to Feed
        </Link>

        {/* Post card */}
        <div className="mb-8 rounded-lg border border-gray-700 bg-gray-800 p-6">
          {/* Header */}
          <div className="mb-4 flex items-start justify-between">
            <div>
              <span className="text-xs uppercase tracking-wide text-gray-500">
                {post.neighborhood?.name || "Unknown"}
              </span>
              <span className="mx-2 text-gray-600">•</span>
              <span className="text-xs text-gray-500">
                {formatRelativeTime(post.created_at)}
              </span>
              {typeof post.reaction_count === "number" &&
                post.reaction_count > 0 && (
                  <>
                    <span className="mx-2 text-gray-600">•</span>
                    <span
                      className="text-xs text-gray-400"
                      title="Reactions on Nextdoor"
                    >
                      {post.reaction_count} reaction
                      {post.reaction_count !== 1 ? "s" : ""}
                    </span>
                  </>
                )}
            </div>
            {scores && (
              <div className="flex items-center gap-2">
                <span className="text-lg font-bold text-yellow-500">
                  {scores.final_score?.toFixed(1) ?? "—"}
                </span>
                {post.ignored && (
                  <span className="rounded bg-gray-700 px-2 py-0.5 text-xs text-gray-300">
                    Ignored
                  </span>
                )}
                {post.used_on_episode && (
                  <span className="rounded bg-green-800 px-2 py-0.5 text-xs text-green-200">
                    Used
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Images */}
          {post.image_urls && post.image_urls.length > 0 && (
            <div className="mb-4 flex flex-wrap gap-2">
              {post.image_urls.map((imageUrl, index) => (
                <a
                  key={`${post.id}-img-${index}`}
                  href={post.url || "#"}
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  <Image
                    alt={`Post ${index + 1}`}
                    className="max-h-48 rounded border border-gray-700 object-cover hover:border-gray-600"
                    height={192}
                    sizes="(max-width: 768px) 100vw, 400px"
                    src={imageUrl}
                    width={400}
                  />
                </a>
              ))}
            </div>
          )}

          {/* Full content */}
          <p className="whitespace-pre-wrap text-gray-200">{post.text}</p>

          {/* Dimension scores with bars */}
          {dimensionScores && Object.keys(dimensionScores).length > 0 && (
            <div className="mt-6">
              <h4 className="mb-3 text-sm font-semibold text-gray-400">
                Score Breakdown
              </h4>
              <div className="space-y-2">
                {Object.entries(dimensionScores).map(([key, value]) => (
                  <div key={key} className="flex items-center gap-3">
                    <span className="w-28 text-xs text-gray-400">
                      {DIMENSION_LABELS[key] || key}
                    </span>
                    <div className="flex-1">
                      <div className="h-2 overflow-hidden rounded-full bg-gray-700">
                        <div
                          className={cn(
                            "h-full rounded-full",
                            (value as number) >= 8 && "bg-green-500",
                            (value as number) >= 6 &&
                              (value as number) < 8 &&
                              "bg-yellow-500",
                            (value as number) >= 4 &&
                              (value as number) < 6 &&
                              "bg-orange-500",
                            (value as number) < 4 && "bg-red-500"
                          )}
                          style={{ width: `${((value as number) / 10) * 100}%` }}
                        />
                      </div>
                    </div>
                    <span className="w-8 text-right text-xs text-gray-400">
                      {(value as number).toFixed(1)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Categories */}
          {scores?.categories && scores.categories.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-1">
              {scores.categories.map((category, index) => (
                <span
                  key={`${category}-${index}`}
                  className="rounded bg-gray-700 px-2 py-0.5 text-xs text-gray-300"
                >
                  {category}
                </span>
              ))}
            </div>
          )}

          {/* Summary */}
          {scores?.summary && (
            <p className="mt-4 italic text-gray-400">&ldquo;{scores.summary}&rdquo;</p>
          )}

          {/* Why podcast worthy */}
          {scores?.why_podcast_worthy && (
            <p className="mt-3 text-amber-200/90">
              {scores.why_podcast_worthy}
            </p>
          )}

          {/* Actions */}
          <div className="mt-6 flex gap-4">
            <button
              className="text-gray-400 transition-colors hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
              disabled={markingIgnored}
              type="button"
              onClick={() => void handleMarkIgnored(!post.ignored)}
            >
              {markingIgnored
                ? "..."
                : post.ignored
                  ? "Unignore"
                  : "Ignore"}
            </button>
            <button
              className="text-blue-400 transition-colors hover:text-blue-300 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={markingSaved}
              type="button"
              onClick={() => void handleMarkSaved(!post.saved)}
            >
              {markingSaved ? "Saving..." : post.saved ? "Unsave" : "Save"}
            </button>
            {post.url && (
              <a
                className="text-blue-400 transition-colors hover:text-blue-300"
                href={post.url}
                rel="noopener noreferrer"
                target="_blank"
              >
                View on Nextdoor
              </a>
            )}
            {!post.used_on_episode && (
              <button
                className="text-green-400 transition-colors hover:text-green-300 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={markingUsed}
                type="button"
                onClick={() => void handleMarkUsed()}
              >
                {markingUsed ? "Marking..." : "Mark as Used"}
              </button>
            )}
          </div>
        </div>

        {/* Related posts */}
        <section>
          <h3 className="mb-4 text-lg font-semibold text-gray-300">
            Related Posts
          </h3>
          {relatedLoading ? (
            <div className="flex justify-center py-8">
              <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-yellow-500" />
            </div>
          ) : relatedPosts.length > 0 ? (
            <div className="space-y-4">
              {relatedPosts.map((relatedPost) => (
                <PostCard
                  key={relatedPost.id}
                  post={relatedPost}
                  onViewDetails={() => router.push(`/posts/${relatedPost.id}`)}
                />
              ))}
            </div>
          ) : (
            <p className="text-gray-500">No related posts found.</p>
          )}
        </section>

        <p className="mt-6 text-xs text-gray-500">
          Press <kbd className="rounded bg-gray-700 px-1">J</kbd> to go back
        </p>
      </div>
    </main>
  );
}
