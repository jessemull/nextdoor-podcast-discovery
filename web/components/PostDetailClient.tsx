"use client";

import {
  ArrowLeft,
  Bookmark,
  Check,
  ExternalLink,
  EyeOff,
  MoreHorizontal,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import { PostCard } from "@/components/PostCard";
import { Card } from "@/components/ui/Card";
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
  const [menuOpen, setMenuOpen] = useState(false);
  const [post, setPost] = useState<null | PostWithScores>(initialPost);
  const [relatedPosts, setRelatedPosts] = useState<PostWithScores[]>([]);
  const [relatedLoading, setRelatedLoading] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    if (!menuOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, [menuOpen]);

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
        <div className="mx-auto max-w-3xl">
          <Card className="border-destructive bg-destructive/10">
            <p className="text-destructive">{error || "Post not found"}</p>
            <Link
              className="mt-4 inline-flex items-center gap-2 text-muted hover:text-foreground"
              href="/"
            >
              <ArrowLeft aria-hidden className="h-4 w-4" />
              Back to Feed
            </Link>
          </Card>
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
          className="mb-6 inline-flex items-center gap-2 text-muted text-sm hover:text-foreground"
          href="/"
        >
          <ArrowLeft aria-hidden className="h-4 w-4" />
          Back to Feed
        </Link>

        {/* Post card */}
        <Card className="mb-8 p-6">
          {/* Header */}
          <div className="mb-4 flex items-start justify-between gap-4">
            <div>
              <span className="text-muted-foreground text-xs uppercase tracking-wide">
                {post.neighborhood?.name || "Unknown"}
              </span>
              <span className="text-muted-foreground mx-2">•</span>
              <span className="text-muted-foreground text-xs">
                {formatRelativeTime(post.created_at)}
              </span>
              {typeof post.reaction_count === "number" &&
                post.reaction_count > 0 && (
                  <>
                    <span className="text-muted-foreground mx-2">•</span>
                    <span
                      className="text-muted text-xs"
                      title="Reactions on Nextdoor"
                    >
                      {post.reaction_count} reaction
                      {post.reaction_count !== 1 ? "s" : ""}
                    </span>
                  </>
                )}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {scores?.final_score != null && (
                <span className="text-foreground text-lg font-semibold">
                  {scores.final_score.toFixed(1)}
                </span>
              )}
              {(post.ignored || post.saved || post.used_on_episode) && (
                <div className="flex gap-1">
                  {post.ignored && (
                    <span className="rounded border border-border bg-surface-hover px-2 py-0.5 text-muted text-xs">
                      Ignored
                    </span>
                  )}
                  {post.saved && (
                    <span className="rounded border border-border bg-surface-hover px-2 py-0.5 text-muted text-xs">
                      Saved
                    </span>
                  )}
                  {post.used_on_episode && (
                    <span className="rounded border border-border bg-surface-hover px-2 py-0.5 text-muted text-xs">
                      Used
                    </span>
                  )}
                </div>
              )}
              {/* Actions dropdown */}
              <div className="relative" ref={menuRef}>
                <button
                  aria-expanded={menuOpen}
                  aria-haspopup="menu"
                  aria-label="Post actions"
                  className={cn(
                    "rounded p-1 transition-colors",
                    "hover:bg-surface-hover focus:outline-none focus:ring-2 focus:ring-border-focus"
                  )}
                  type="button"
                  onClick={() => setMenuOpen((o) => !o)}
                >
                  <MoreHorizontal
                    aria-hidden
                    className="h-5 w-5 text-muted"
                  />
                </button>
                {menuOpen && (
                  <div
                    className="border-border bg-surface absolute right-0 top-full z-10 mt-1 min-w-[11rem] rounded-card border py-1 shadow-lg"
                    role="menu"
                  >
                    {post.url && (
                      <a
                        className="flex items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-surface-hover"
                        href={post.url}
                        rel="noopener noreferrer"
                        role="menuitem"
                        target="_blank"
                        onClick={() => setMenuOpen(false)}
                      >
                        <ExternalLink aria-hidden className="h-4 w-4" />
                        View on Nextdoor
                      </a>
                    )}
                    <button
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-foreground hover:bg-surface-hover disabled:opacity-50"
                      disabled={markingSaved}
                      role="menuitem"
                      type="button"
                      onClick={() => {
                        setMenuOpen(false);
                        void handleMarkSaved(!post.saved);
                      }}
                    >
                      <Bookmark aria-hidden className="h-4 w-4" />
                      {markingSaved
                        ? "Saving..."
                        : post.saved
                          ? "Unsave"
                          : "Save"}
                    </button>
                    <button
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-foreground hover:bg-surface-hover disabled:opacity-50"
                      disabled={markingIgnored}
                      role="menuitem"
                      type="button"
                      onClick={() => {
                        setMenuOpen(false);
                        void handleMarkIgnored(!post.ignored);
                      }}
                    >
                      <EyeOff aria-hidden className="h-4 w-4" />
                      {markingIgnored
                        ? "..."
                        : post.ignored
                          ? "Unignore"
                          : "Ignore"}
                    </button>
                    {!post.used_on_episode && (
                      <button
                        className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-foreground hover:bg-surface-hover disabled:opacity-50"
                        disabled={markingUsed}
                        role="menuitem"
                        type="button"
                        onClick={() => {
                          setMenuOpen(false);
                          void handleMarkUsed();
                        }}
                      >
                        <Check aria-hidden className="h-4 w-4" />
                        {markingUsed ? "Marking..." : "Mark as used"}
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
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
                    className="max-h-48 rounded border border-border object-cover hover:border-border-focus"
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
          <p className="whitespace-pre-wrap text-foreground">{post.text}</p>

          {/* Score breakdown - neutral bars */}
          {dimensionScores &&
            Object.keys(dimensionScores).length > 0 && (
              <div className="mt-6">
                <h4 className="mb-3 text-muted-foreground text-sm font-semibold">
                  Score breakdown
                </h4>
                <div className="space-y-2">
                  {Object.entries(dimensionScores).map(([key, value]) => (
                    <div
                      key={key}
                      className="flex items-center gap-3"
                    >
                      <span className="text-muted w-28 text-xs">
                        {DIMENSION_LABELS[key] || key}
                      </span>
                      <div className="flex-1">
                        <div className="bg-surface-hover h-2 overflow-hidden rounded-full">
                          <div
                            className="bg-muted h-full rounded-full"
                            style={{
                              width: `${((value as number) / 10) * 100}%`,
                            }}
                          />
                        </div>
                      </div>
                      <span className="text-muted w-8 text-right text-xs">
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
                  className="rounded border border-border bg-surface-hover px-2 py-0.5 text-muted text-xs"
                >
                  {category}
                </span>
              ))}
            </div>
          )}

          {/* Summary */}
          {scores?.summary && (
            <p className="text-muted mt-4 italic">
              &ldquo;{scores.summary}&rdquo;
            </p>
          )}

          {/* Why podcast worthy */}
          {scores?.why_podcast_worthy && (
            <p className="text-muted mt-3 text-sm">
              {scores.why_podcast_worthy}
            </p>
          )}
        </Card>

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
