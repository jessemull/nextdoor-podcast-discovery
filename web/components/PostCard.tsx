"use client";

import {
  Bookmark,
  Check,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  EyeOff,
  List,
  MessageSquare,
  MoreHorizontal,
  RefreshCw,
  Search,
  X,
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
  formatTitleCase,
  POST_PREVIEW_LENGTH,
} from "@/lib/utils";

import type { DimensionScores } from "@/lib/types";

const DIMENSION_LABELS: Record<keyof DimensionScores, string> = {
  absurdity: "Absurdity",
  discussion_spark: "Discussion",
  drama: "Drama",
  emotional_intensity: "Intensity",
  news_value: "News",
  podcast_worthy: "Podcast",
  readability: "Readability",
};

export type QueueStatus = "pending" | "running" | null;

interface PostCardProps {
  activeJobId?: null | string;
  defaultExpanded?: boolean;
  isCancellingRefresh?: boolean;
  isMarkingIgnored?: boolean;
  isMarkingSaved?: boolean;
  isMarkingUsed?: boolean;
  isQueuingRefresh?: boolean;
  onCancelRefresh?: (jobId: string) => void;
  onMarkIgnored?: (postId: string, ignored: boolean) => void;
  onMarkSaved?: (postId: string, saved: boolean) => void;
  onMarkUsed?: (postId: string) => void;
  onQueueRefresh?: (postId: string) => void;
  onSelect?: (postId: string, selected: boolean) => void;
  onViewDetails?: (postId: string) => void;
  post: { ignored?: boolean; saved?: boolean; similarity?: number } & PostWithScores;
  queueStatus?: QueueStatus;
  selected?: boolean;
  showCheckbox?: boolean;
  showScoreBreakdown?: boolean;
}

export const PostCard = memo(function PostCard({
  activeJobId = null,
  defaultExpanded = false,
  isCancellingRefresh = false,
  isMarkingIgnored = false,
  isMarkingSaved = false,
  isMarkingUsed = false,
  isQueuingRefresh = false,
  onCancelRefresh,
  onMarkIgnored,
  onMarkSaved,
  onMarkUsed,
  onQueueRefresh,
  onSelect,
  onViewDetails,
  post,
  queueStatus = null,
  selected = false,
  showCheckbox = false,
  showScoreBreakdown = false,
}: PostCardProps) {
  const scores = post.llm_scores;
  const [carouselOverflows, setCarouselOverflows] = useState(false);
  const [carouselDragging, setCarouselDragging] = useState(false);
  const [expanded, setExpanded] = useState(!!defaultExpanded);
  const [mainImageIndex, setMainImageIndex] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const carouselRef = useRef<HTMLDivElement>(null);
  const carouselDragStart = useRef<{ scrollLeft: number; x: number } | null>(null);
  const carouselDidDrag = useRef(false);
  const carouselIgnoreNextClick = useRef(false);
  const carouselPendingIndex = useRef<null | number>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const imageUrls = post.image_urls ?? [];
  const mainImageUrl = imageUrls[mainImageIndex] ?? imageUrls[0];
  const hasMultipleImages = imageUrls.length > 1;
  const carouselUrls = imageUrls;

  const closeMenu = useCallback(() => setMenuOpen(false), []);

  const handleCarouselPointerDown = useCallback((e: React.PointerEvent) => {
    const el = carouselRef.current;
    if (!el) return;
    e.preventDefault();
    e.stopPropagation();
    const thumb = (e.target as HTMLElement).closest("[data-thumb-index]");
    carouselPendingIndex.current =
      thumb != null ? Number((thumb as HTMLElement).dataset.thumbIndex) : null;
    carouselDragStart.current = { scrollLeft: el.scrollLeft, x: e.clientX };
    carouselDidDrag.current = false;
    setCarouselDragging(false);
    el.setPointerCapture(e.pointerId);
  }, []);

  const handleCarouselPointerMove = useCallback((e: React.PointerEvent) => {
    const el = carouselRef.current;
    const start = carouselDragStart.current;
    if (!el || !start) return;
    e.preventDefault();
    const dx = start.x - e.clientX;
    if (Math.abs(dx) > 5) {
      carouselDidDrag.current = true;
      setCarouselDragging(true);
    }
    el.scrollLeft = start.scrollLeft + dx;
  }, []);

  const handleCarouselPointerUp = useCallback(() => {
    if (carouselDidDrag.current) {
      carouselIgnoreNextClick.current = true;
      setTimeout(() => {
        carouselIgnoreNextClick.current = false;
      }, 0);
    } else if (carouselPendingIndex.current != null) {
      setMainImageIndex(carouselPendingIndex.current);
    }
    carouselDragStart.current = null;
    carouselPendingIndex.current = null;
    carouselDidDrag.current = false;
    setCarouselDragging(false);
  }, []);

  useEffect(() => {
    if (!hasMultipleImages) return;
    const el = carouselRef.current;
    if (!el) return;

    const checkOverflow = () => {
      setCarouselOverflows(el.scrollWidth > el.clientWidth);
    };

    checkOverflow();
    const raf = requestAnimationFrame(checkOverflow);
    const ro = new ResizeObserver(checkOverflow);
    ro.observe(el);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [hasMultipleImages, carouselUrls.length]);

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

  const neighborhoodName = formatTitleCase(
    post.neighborhood?.name ?? "Unknown"
  );

  /** Final score is normalized 0–10 then × novelty (≈0.2–1.5), so roughly 0–15. Color by 0–10 bands. */
  const scoreColorClass =
    scores?.final_score == null
      ? ""
      : scores.final_score < 4
        ? "text-red-400"
        : scores.final_score < 6
          ? "text-amber-400"
          : scores.final_score < 8
            ? "text-emerald-600"
            : "text-emerald-500";

  const scoreCircleBorderClass =
    scores?.final_score == null
      ? ""
      : scores.final_score < 4
        ? "border-red-400"
        : scores.final_score < 6
          ? "border-amber-400"
          : scores.final_score < 8
            ? "border-emerald-600"
            : "border-emerald-500";

  const breadcrumbs = (
    <div className="flex min-w-0 flex-wrap items-center gap-x-2">
      {post.author_name && (
        <>
          <span className="text-foreground text-sm">{post.author_name}</span>
          <span className="text-muted-foreground text-sm">•</span>
        </>
      )}
      <span className="text-foreground text-sm font-medium tracking-wide">
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
      {Array.isArray(post.comments) && post.comments.length > 0 && (
        <>
          <span className="text-muted-foreground text-sm">•</span>
          <Link
            className="text-foreground hover:underline text-sm font-medium"
            href={`/posts/${post.id}#comments`}
            title="View Comments"
          >
            <MessageSquare
              aria-hidden
              className="inline h-3.5 w-3.5 align-middle"
            />
            <span className="ml-1">
              {post.comments.length} Comment
              {post.comments.length !== 1 ? "s" : ""}
            </span>
          </Link>
        </>
      )}
      {queueStatus === "pending" && (
        <>
          <span className="text-muted-foreground text-sm">•</span>
          <span className="shrink-0 rounded border border-amber-500/70 bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-600">
            Queued
          </span>
        </>
      )}
      {queueStatus === "running" && (
        <>
          <span className="text-muted-foreground text-sm">•</span>
          <span className="shrink-0 rounded border border-blue-500/70 bg-blue-500/10 px-2 py-0.5 text-xs font-medium text-blue-600">
            Processing
          </span>
        </>
      )}
    </div>
  );

  const tagsBlock =
    scores?.categories && scores.categories.length > 0 ? (
      <div className="flex flex-wrap items-center gap-1.5">
        {scores.categories.slice(0, 5).map((category: string, index: number) => (
          <span
            key={`${category}-${index}`}
            className="rounded-md border border-white/25 bg-surface-hover/80 px-2 py-0.5 text-foreground/90 text-xs font-medium"
          >
            {formatCategoryLabel(category)}
          </span>
        ))}
      </div>
    ) : null;

  const statusBadges =
    post.ignored || post.used_on_episode ? (
      <div className="flex flex-wrap items-center gap-1.5">
        {post.ignored && (
          <span className="border border-amber-500/60 bg-amber-500/15 px-2 py-0.5 rounded text-amber-400 text-xs font-medium">
            Ignored
          </span>
        )}
        {post.used_on_episode && (
          <span className="border border-violet-500/60 bg-violet-500/15 px-2 py-0.5 rounded text-violet-400 text-xs font-medium">
            Used
          </span>
        )}
      </div>
    ) : null;

  const actionsBlock = (
    <div className="flex shrink-0 items-center gap-1">
      {showCheckbox && onSelect ? (
        <input
          aria-label={`Select post from ${neighborhoodName}`}
          checked={selected}
          className="rounded border-border bg-surface-hover"
          type="checkbox"
          onChange={(e) => onSelect(post.id, e.target.checked)}
        />
      ) : (
        <>
          {post.similarity != null && (
            <span
              className="border border-orange-500/60 bg-orange-500/15 px-1.5 py-0.5 rounded text-orange-400 text-xs font-medium"
              title="Semantic Similarity To Search Query"
            >
              <span className="hidden sm:inline">SIM </span>
              {post.similarity.toFixed(2)}
            </span>
          )}
          {statusBadges != null && (
            <div className="hidden flex-wrap justify-end gap-1 sm:flex">
              {statusBadges}
            </div>
          )}
          {onMarkSaved && (
            <button
              aria-label={post.saved ? "Unsave" : "Save"}
              className="cursor-pointer rounded p-1 focus:outline-none focus:ring-2 focus:ring-border-focus"
              disabled={isMarkingSaved}
              title={post.saved ? "Unsave" : "Save"}
              type="button"
              onClick={() => onMarkSaved(post.id, !post.saved)}
            >
              <Bookmark
                aria-hidden
                className={cn(
                  "h-4 w-4",
                  post.saved ? "fill-current text-red-600" : "text-foreground"
                )}
              />
            </button>
          )}
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
                <Link
                  className="flex items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-surface-hover"
                  href={`/feed?q=${encodeURIComponent(
                    (post.text || scores?.summary || "").slice(0, 80)
                  )}`}
                  role="menuitem"
                  onClick={closeMenu}
                >
                  <Search aria-hidden className="h-4 w-4" />
                  Find similar
                </Link>
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
                {post.url &&
                  (queueStatus && activeJobId && onCancelRefresh ? (
                    <button
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-foreground hover:bg-surface-hover disabled:opacity-50"
                      disabled={isCancellingRefresh}
                      role="menuitem"
                      type="button"
                      onClick={() => {
                        closeMenu();
                        onCancelRefresh(activeJobId);
                      }}
                    >
                      <X
                        aria-hidden
                        className={cn(
                          "h-4 w-4",
                          isCancellingRefresh && "animate-pulse"
                        )}
                      />
                      {isCancellingRefresh ? "Cancelling…" : "Cancel Refresh"}
                    </button>
                  ) : (
                    onQueueRefresh && (
                      <button
                        className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-foreground hover:bg-surface-hover disabled:opacity-50"
                        disabled={isQueuingRefresh}
                        role="menuitem"
                        type="button"
                        onClick={() => {
                          closeMenu();
                          onQueueRefresh(post.id);
                        }}
                      >
                        <RefreshCw
                          aria-hidden
                          className={cn(
                            "h-4 w-4",
                            isQueuingRefresh && "animate-pulse"
                          )}
                        />
                        {isQueuingRefresh ? "Queuing…" : "Refresh Post"}
                      </button>
                    )
                  ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );

  return (
    <Card className="px-4 py-5 transition-colors hover:border-border-focus">
      {/* Mobile: compact row (score + breadcrumbs + actions) then tags row; desktop: original layout */}
      <div className="mb-4 flex flex-col gap-2 sm:mb-6 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
        <div className="flex min-w-0 items-start gap-2 sm:contents">
          {scores?.final_score != null && (
            <div className="flex h-10 w-10 shrink-0 items-center justify-center sm:w-16 sm:items-start sm:justify-start">
              <span
                className={cn(
                  "inline-flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full border-2 text-sm font-semibold sm:h-14 sm:w-14 sm:text-base",
                  scoreColorClass || "text-foreground",
                  scoreCircleBorderClass || "border-border"
                )}
              >
                {scores.final_score.toFixed(1)}
              </span>
            </div>
          )}
          <div className="min-w-0 flex-1 sm:flex sm:flex-col sm:gap-3">
            {breadcrumbs}
            <div className="hidden sm:block">{tagsBlock}</div>
          </div>
          {actionsBlock}
        </div>
        {tagsBlock != null && (
          <div className="sm:hidden">{tagsBlock}</div>
        )}
        {statusBadges != null && (
          <div className="flex flex-wrap items-center gap-1.5 sm:hidden">
            {statusBadges}
          </div>
        )}
      </div>

      {/* Images: main full-width with border + radius; carousel floats below (no shared container) */}
      {imageUrls.length > 0 && (
        <>
          <div
            className={cn(
              "relative aspect-[21/10] w-full overflow-hidden rounded-lg border border-border bg-surface-hover",
              hasMultipleImages ? "" : "mb-6"
            )}
          >
            <Image
              alt="Post"
              className="object-cover"
              fill
              sizes="(max-width: 768px) 100vw, 672px"
              src={mainImageUrl}
            />
          </div>
          {hasMultipleImages && (
            <div className="relative mb-6 mt-2 flex items-center gap-1">
              {carouselOverflows && (
                <button
                  aria-label="Previous image"
                  className="cursor-pointer flex shrink-0 rounded p-1 focus:outline-none focus:ring-2 focus:ring-border-focus"
                  type="button"
                  onClick={() => {
                    carouselRef.current?.scrollBy({ behavior: "smooth", left: -88 });
                  }}
                >
                  <ChevronLeft aria-hidden className="h-5 w-5 text-foreground" />
                </button>
              )}
              <div
                className={cn(
                  "flex min-w-0 flex-1 flex-nowrap gap-2 overflow-x-auto px-0 py-1 scroll-smooth [scrollbar-width:none] [-webkit-overflow-scrolling:touch] [&::-webkit-scrollbar]:hidden",
                  carouselOverflows && (carouselDragging ? "cursor-grabbing" : "cursor-grab")
                )}
                ref={carouselRef}
                onPointerCancel={handleCarouselPointerUp}
                onPointerDownCapture={handleCarouselPointerDown}
                onPointerLeave={handleCarouselPointerUp}
                onPointerMove={handleCarouselPointerMove}
                onPointerUp={handleCarouselPointerUp}
              >
                {carouselUrls.map((imageUrl, index) => (
                  <button
                    key={`${post.id}-thumb-${index}`}
                    aria-pressed={index === mainImageIndex}
                    className={cn(
                      "relative h-16 w-16 shrink-0 cursor-inherit overflow-hidden rounded border-2 transition-colors",
                      index === mainImageIndex
                        ? "border-foreground"
                        : "border-border hover:border-border-focus"
                    )}
                    data-thumb-index={index}
                    type="button"
                    onClick={() => {
                      if (carouselIgnoreNextClick.current) return;
                      setMainImageIndex(index);
                    }}
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
              {carouselOverflows && (
                <button
                  aria-label="Next image"
                  className="cursor-pointer flex shrink-0 rounded p-1 focus:outline-none focus:ring-2 focus:ring-border-focus"
                  type="button"
                  onClick={() => {
                    carouselRef.current?.scrollBy({ behavior: "smooth", left: 88 });
                  }}
                >
                  <ChevronRight aria-hidden className="h-5 w-5 text-foreground" />
                </button>
              )}
            </div>
          )}
        </>
      )}

      {/* Score breakdown (detail page only) */}
      {showScoreBreakdown && (() => {
        const raw = scores?.scores;
        if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
        const entries = Object.entries(raw).filter(
          (entry): entry is [string, number] => {
            const v = entry[1];
            const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
            return Number.isFinite(n) && n >= 0 && n <= 10;
          }
        );
        if (entries.length === 0) return null;
        return (
          <div className="mb-6">
            <h3 className="text-foreground mb-2 text-base font-semibold uppercase tracking-wide">
              Score breakdown
            </h3>
            <div className="space-y-2">
              {entries.map(([key, value]) => {
                const num = typeof value === "number" ? value : Number(value);
                return (
                  <div
                    key={key}
                    className="flex items-center gap-3"
                  >
                    <span
                      className="text-foreground w-28 text-sm"
                      style={{ opacity: 0.85 }}
                    >
                      {DIMENSION_LABELS[key as keyof DimensionScores] ?? key}
                    </span>
                    <div className="flex-1">
                      <div className="bg-surface-hover h-2 overflow-hidden rounded-full">
                        <div
                          className="h-full rounded-full"
                          style={{
                            background:
                              "linear-gradient(90deg, rgb(71 85 105), rgb(34 211 238))",
                            opacity: 0.9,
                            width: `${(num / 10) * 100}%`,
                          }}
                        />
                      </div>
                    </div>
                    <span
                      className="text-foreground w-8 text-right text-sm"
                      style={{ opacity: 0.85 }}
                    >
                      {num.toFixed(1)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}

      {/* Content */}
      {scores?.summary && (
        <div className="mb-6">
          <h3 className="text-foreground mb-2 text-base font-semibold uppercase tracking-wide">
            AI Summary
          </h3>
          <p
            className="text-foreground text-sm"
            style={{ opacity: 0.85 }}
          >
            {scores.summary}
          </p>
        </div>
      )}
      <div>
        <h3 className="text-foreground mb-2 text-base font-semibold uppercase tracking-wide">
          Original post
        </h3>
        <p
          className="text-foreground text-sm"
          style={{ opacity: 0.85 }}
        >
          {expanded
            ? post.text
            : post.text.length > POST_PREVIEW_LENGTH
              ? (
                  <>
                    {post.text.slice(0, POST_PREVIEW_LENGTH - 3)}
                    <button
                      className="text-foreground hover:underline focus:outline-none focus:ring-2 focus:ring-border-focus"
                      type="button"
                      onClick={() => setExpanded(true)}
                    >
                      ...
                    </button>
                  </>
                )
              : post.text}
        </p>
      </div>
    </Card>
  );
});
