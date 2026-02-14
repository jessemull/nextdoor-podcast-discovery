"use client";

import {
  Bookmark,
  Check,
  ChevronLeft,
  ChevronRight,
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
import {
  cn,
  formatCategoryLabel,
  formatRelativeTime,
  POST_PREVIEW_LENGTH,
  truncate,
} from "@/lib/utils";

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
  const [expanded, setExpanded] = useState(false);
  const [mainImageIndex, setMainImageIndex] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const carouselRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const imageUrls = post.image_urls ?? [];
  const mainImageUrl = imageUrls[mainImageIndex] ?? imageUrls[0];
  const hasMultipleImages = imageUrls.length > 1;
  const carouselUrls = imageUrls;

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
          <div className="flex min-w-0 flex-wrap items-center gap-x-2 truncate">
            <span className="text-foreground text-sm font-medium uppercase tracking-wide">
              {neighborhoodName}
            </span>
            <span className="text-muted-foreground text-sm">•</span>
            <span className="text-foreground text-sm">
              {formatRelativeTime(post.created_at)}
            </span>
            {typeof post.reaction_count === "number" && post.reaction_count > 0 && (
              <>
                <span className="text-muted-foreground text-sm">•</span>
                <span
                  className="text-foreground text-sm font-medium"
                  title="Reactions On Nextdoor"
                >
                  {post.reaction_count} Reaction
                  {post.reaction_count !== 1 ? "s" : ""}
                </span>
              </>
            )}
            {scores?.final_score != null && (
              <>
                <span className="text-muted-foreground text-sm">•</span>
                <span className="text-foreground text-sm font-semibold">
                  {scores.final_score.toFixed(1)}
                </span>
              </>
            )}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {post.similarity != null && (
            <span
              className="text-muted text-xs"
              title="Semantic Similarity To Search Query"
            >
              Sim: {post.similarity.toFixed(2)}
            </span>
          )}
          {(post.ignored || post.used_on_episode) && (
            <div className="flex flex-wrap justify-end gap-1">
              {post.ignored && (
                <span className="rounded border border-border bg-surface-hover px-2 py-0.5 text-muted text-xs">
                  Ignored
                </span>
              )}
              {post.used_on_episode && (
                <span className="rounded border border-border bg-surface-hover px-2 py-0.5 text-muted text-xs">
                  Used
                </span>
              )}
            </div>
          )}
          {/* Quick actions (icon-only, white; saved = filled bookmark only) */}
          {onViewDetails && (
            <button
              aria-label="View Details"
              className="cursor-pointer rounded p-1 focus:outline-none focus:ring-2 focus:ring-border-focus"
              title="View Details"
              type="button"
              onClick={() => onViewDetails(post.id)}
            >
              <List aria-hidden className="h-4 w-4 text-foreground" />
            </button>
          )}
          {post.url && (
            <a
              aria-label="View On Nextdoor"
              className="cursor-pointer rounded p-1 focus:outline-none focus:ring-2 focus:ring-border-focus"
              href={post.url}
              rel="noopener noreferrer"
              target="_blank"
              title="View On Nextdoor"
            >
              <ExternalLink aria-hidden className="h-4 w-4 text-foreground" />
            </a>
          )}
          {onMarkSaved && (
            <button
              aria-label={post.saved ? "Unsave" : "Save"}
              className={cn(
                "cursor-pointer rounded p-1 focus:outline-none focus:ring-2 focus:ring-border-focus",
                post.saved && "text-foreground"
              )}
              disabled={isMarkingSaved}
              title={post.saved ? "Unsave" : "Save"}
              type="button"
              onClick={() => onMarkSaved(post.id, !post.saved)}
            >
              <Bookmark
                aria-hidden
                className={cn("h-4 w-4", post.saved ? "fill-current text-foreground" : "text-foreground")}
              />
            </button>
          )}
          {/* Actions dropdown */}
          <div className="relative" ref={menuRef}>
            <button
              aria-expanded={menuOpen}
              aria-haspopup="menu"
              aria-label="More actions"
              className="cursor-pointer rounded p-1 focus:outline-none focus:ring-2 focus:ring-border-focus"
              type="button"
              onClick={() => setMenuOpen((o) => !o)}
            >
              <MoreHorizontal aria-hidden className="h-4 w-4 text-foreground" />
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

      {/* Images: main full-width, carousel below with arrows */}
      {imageUrls.length > 0 && (
        <div className="border-border mb-3 rounded-lg border">
          <div className="relative aspect-[21/10] w-full overflow-hidden rounded-t-lg border-b border-border bg-surface-hover">
            <Image
              alt="Post"
              className="object-cover"
              fill
              sizes="(max-width: 768px) 100vw, 672px"
              src={mainImageUrl}
            />
          </div>
          {hasMultipleImages && (
            <div className="relative flex items-center gap-1 rounded-b-lg p-2">
              <button
                aria-label="Previous image"
                className="flex shrink-0 rounded p-1 transition-colors hover:bg-surface-hover disabled:opacity-40"
                type="button"
                onClick={() => {
                  carouselRef.current?.scrollBy({ left: -88, behavior: "smooth" });
                }}
              >
                <ChevronLeft aria-hidden className="h-5 w-5 text-muted" />
              </button>
              <div
                className="flex min-w-0 flex-1 flex-nowrap gap-2 overflow-x-auto py-1 scroll-smooth [scrollbar-width:none] [-webkit-overflow-scrolling:touch] [&::-webkit-scrollbar]:hidden"
                ref={carouselRef}
              >
                {carouselUrls.map((imageUrl, index) => (
                  <button
                    key={`${post.id}-thumb-${index}`}
                    className={cn(
                      "relative h-16 w-16 shrink-0 overflow-hidden rounded border-2 transition-colors",
                      index === mainImageIndex
                        ? "border-foreground"
                        : "border-border hover:border-border-focus"
                    )}
                    type="button"
                    onClick={() => setMainImageIndex(index)}
                  >
                    <Image
                      alt={`Image ${index + 1}`}
                      className="object-cover"
                      fill
                      sizes="64px"
                      src={imageUrl}
                    />
                  </button>
                ))}
              </div>
              <button
                aria-label="Next image"
                className="flex shrink-0 rounded p-1 transition-colors hover:bg-surface-hover disabled:opacity-40"
                type="button"
                onClick={() => {
                  carouselRef.current?.scrollBy({ left: 88, behavior: "smooth" });
                }}
              >
                <ChevronRight aria-hidden className="h-5 w-5 text-muted" />
              </button>
            </div>
          )}
        </div>
      )}

      {/* Content */}
      {scores?.summary && (
        <h3 className="text-foreground mb-1 text-sm font-semibold">
          {truncate(scores.summary, 80)}
        </h3>
      )}
      <p className="text-foreground mb-3 text-sm">
        {expanded ? post.text : truncate(post.text, POST_PREVIEW_LENGTH)}
        {!expanded && post.text.length > POST_PREVIEW_LENGTH && (
          <button
            className="text-muted-foreground hover:text-foreground ml-1 inline align-baseline text-sm underline focus:outline-none focus:ring-2 focus:ring-border-focus"
            type="button"
            onClick={() => setExpanded(true)}
          >
            ...
          </button>
        )}
      </p>

      {/* Categories (one line) */}
      {scores?.categories && scores.categories.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {scores.categories.slice(0, 5).map((category: string, index: number) => (
            <span
              key={`${category}-${index}`}
              className="rounded border border-white bg-surface-hover px-2 py-0.5 text-muted text-xs"
            >
              {formatCategoryLabel(category)}
            </span>
          ))}
        </div>
      )}
    </Card>
  );
});
