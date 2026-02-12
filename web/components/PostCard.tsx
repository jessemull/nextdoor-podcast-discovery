"use client";

import {
  Bookmark,
  Check,
  ExternalLink,
  EyeOff,
  List,
  MoreHorizontal,
  Search,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { memo, useCallback, useEffect, useRef, useState } from "react";

import { Card } from "@/components/ui/Card";
import { PostWithScores } from "@/lib/types";
import { cn, formatRelativeTime, POST_PREVIEW_LENGTH, truncate } from "@/lib/utils";

interface PostCardProps {
  isMarkingIgnored?: boolean;
  isMarkingSaved?: boolean;
  isMarkingUsed?: boolean;
  onMarkIgnored?: (postId: string, ignored: boolean) => void;
  onMarkSaved?: (postId: string, saved: boolean) => void;
  onMarkUsed?: (postId: string) => void;
  onSelect?: (postId: string, selected: boolean) => void;
  onViewDetails?: (postId: string) => void;
  post: { ignored?: boolean; saved?: boolean; similarity?: number } & PostWithScores;
  selected?: boolean;
  showCheckbox?: boolean;
}

export const PostCard = memo(function PostCard({
  isMarkingIgnored = false,
  isMarkingSaved = false,
  isMarkingUsed = false,
  onMarkIgnored,
  onMarkSaved,
  onMarkUsed,
  onSelect,
  onViewDetails,
  post,
  selected = false,
  showCheckbox = false,
}: PostCardProps) {
  const scores = post.llm_scores;
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const closeMenu = useCallback(() => setMenuOpen(false), []);

  useEffect(() => {
    if (!menuOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        closeMenu();
      }
    };
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, [menuOpen, closeMenu]);

  const neighborhoodName = post.neighborhood?.name ?? "Unknown";

  return (
    <Card className="transition-colors hover:border-border-focus">
      {/* Header */}
      <div className="mb-3 flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          {showCheckbox && onSelect && (
            <input
              aria-label={`Select post from ${neighborhoodName}`}
              checked={selected}
              className="rounded border-border bg-surface-hover"
              type="checkbox"
              onChange={(e) => onSelect(post.id, e.target.checked)}
            />
          )}
          <div className="min-w-0 truncate">
            <span className="text-muted-foreground text-xs uppercase tracking-wide">
              {neighborhoodName}
            </span>
            <span className="text-muted-foreground mx-2 text-xs">•</span>
            <span className="text-muted-foreground text-xs">
              {formatRelativeTime(post.created_at)}
            </span>
            {typeof post.reaction_count === "number" && post.reaction_count > 0 && (
              <>
                <span className="text-muted-foreground mx-2 text-xs">•</span>
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
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {scores?.final_score != null && (
            <span className="text-foreground text-sm font-semibold">
              {scores.final_score.toFixed(1)}
            </span>
          )}
          {post.similarity != null && (
            <span
              className="text-muted text-xs"
              title="Semantic similarity to search query"
            >
              Sim: {post.similarity.toFixed(2)}
            </span>
          )}
          {(post.ignored || post.saved || post.used_on_episode) && (
            <div className="flex flex-wrap justify-end gap-1">
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
              <MoreHorizontal aria-hidden className="h-5 w-5 text-muted" />
            </button>
            {menuOpen && (
              <div
                className="border-border bg-surface absolute right-0 top-full z-10 mt-1 min-w-[11rem] rounded-card border py-1 shadow-lg"
                role="menu"
              >
                {onViewDetails && (
                  <button
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-foreground hover:bg-surface-hover"
                    role="menuitem"
                    type="button"
                    onClick={() => {
                      closeMenu();
                      onViewDetails(post.id);
                    }}
                  >
                    <List aria-hidden className="h-4 w-4" />
                    View details
                  </button>
                )}
                <Link
                  className="flex items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-surface-hover"
                  href={`/search?q=${encodeURIComponent(
                    (post.text || scores?.summary || "").slice(0, 80)
                  )}`}
                  role="menuitem"
                  onClick={closeMenu}
                >
                  <Search aria-hidden className="h-4 w-4" />
                  Find similar
                </Link>
                {post.url && (
                  <a
                    aria-label="View on Nextdoor"
                    className="flex items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-surface-hover"
                    href={post.url}
                    rel="noopener noreferrer"
                    role="menuitem"
                    target="_blank"
                    onClick={closeMenu}
                  >
                    <ExternalLink aria-hidden className="h-4 w-4" />
                    View on Nextdoor
                  </a>
                )}
                {onMarkSaved && (
                  <button
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-foreground hover:bg-surface-hover disabled:opacity-50"
                    disabled={isMarkingSaved}
                    role="menuitem"
                    type="button"
                    onClick={() => {
                      closeMenu();
                      onMarkSaved(post.id, !post.saved);
                    }}
                  >
                    <Bookmark aria-hidden className="h-4 w-4" />
                    {isMarkingSaved
                      ? "Saving..."
                      : post.saved
                        ? "Unsave"
                        : "Save"}
                  </button>
                )}
                {onMarkIgnored && (
                  <button
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-foreground hover:bg-surface-hover disabled:opacity-50"
                    disabled={isMarkingIgnored}
                    role="menuitem"
                    type="button"
                    onClick={() => {
                      closeMenu();
                      onMarkIgnored(post.id, !post.ignored);
                    }}
                  >
                    <EyeOff aria-hidden className="h-4 w-4" />
                    {isMarkingIgnored
                      ? "..."
                      : post.ignored
                        ? "Unignore"
                        : "Ignore"}
                  </button>
                )}
                {!post.used_on_episode && onMarkUsed && (
                  <button
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-foreground hover:bg-surface-hover disabled:opacity-50"
                    disabled={isMarkingUsed}
                    role="menuitem"
                    type="button"
                    onClick={() => {
                      closeMenu();
                      onMarkUsed(post.id);
                    }}
                  >
                    <Check aria-hidden className="h-4 w-4" />
                    {isMarkingUsed ? "Marking..." : "Mark as used"}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Images */}
      {post.image_urls && post.image_urls.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-2">
          {post.image_urls.slice(0, 4).map((imageUrl, index) => (
            <a
              key={`${post.id}-img-${index}`}
              href={post.url || "#"}
              rel="noopener noreferrer"
              target="_blank"
            >
              <Image
                alt={`Post ${index + 1}`}
                className="h-24 w-24 rounded border border-border object-cover transition-colors hover:border-border-focus"
                height={96}
                sizes="96px"
                src={imageUrl}
                width={96}
              />
            </a>
          ))}
          {post.image_urls.length > 4 && (
            <div className="flex h-24 w-24 items-center justify-center rounded border border-border bg-surface-hover text-muted text-xs">
              +{post.image_urls.length - 4}
            </div>
          )}
        </div>
      )}

      {/* Content */}
      <p className="text-foreground mb-3 text-sm">
        {truncate(post.text, POST_PREVIEW_LENGTH)}
      </p>

      {/* Categories (one line) */}
      {scores?.categories && scores.categories.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {scores.categories.slice(0, 5).map((category: string, index: number) => (
            <span
              key={`${category}-${index}`}
              className="rounded border border-border bg-surface-hover px-2 py-0.5 text-muted text-xs"
            >
              {category}
            </span>
          ))}
        </div>
      )}
    </Card>
  );
});
