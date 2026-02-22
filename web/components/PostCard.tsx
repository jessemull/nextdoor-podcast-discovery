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
  ThumbsUp,
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
  onMarkUsedChange?: (postId: string, used: boolean) => void;
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
  onMarkUsedChange,
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

  const categoriesToShow = (scores?.categories ?? []).slice(0, 5);

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
          {onMarkSaved && (
            <button
              aria-label={post.saved ? "Unsave" : "Save"}
              className="cursor-pointer rounded p-1 focus:outline-none focus:ring-2 focus:ring-border-focus"
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
              className="hidden cursor-pointer rounded p-1 focus:outline-none focus:ring-2 focus:ring-border-focus md:block"
              title="View Details"
              type="button"
              onClick={() => onViewDetails(post.id)}
            >
              <List aria-hidden className="h-4 w-4 text-foreground" />
            </button>
          )}
          {post.url && (
            <a
              aria-label="View on Nextdoor"
              className="hidden cursor-pointer rounded p-1 focus:outline-none focus:ring-2 focus:ring-border-focus md:inline-block"
              href={post.url}
              rel="noopener noreferrer"
              target="_blank"
              title="View on Nextdoor"
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
            {menuOpen && (() => {
              const menuItems: { label: string; node: React.ReactNode }[] = [];
              menuItems.push({
                label: "Find similar",
                node: (
                  <Link
                    key="find-similar"
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
                ),
              });
              if (onViewDetails) {
                menuItems.push({
                  label: "View Details",
                  node: (
                    <button
                      key="view-details"
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-foreground hover:bg-surface-hover"
                      role="menuitem"
                      type="button"
                      onClick={() => {
                        closeMenu();
                        onViewDetails(post.id);
                      }}
                    >
                      <List aria-hidden className="h-4 w-4" />
                      View Details
                    </button>
                  ),
                });
              }
              if (post.url) {
                menuItems.push({
                  label: "View on Nextdoor",
                  node: (
                    <a
                      key="view-nextdoor"
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
                  ),
                });
              }
              if (onMarkIgnored) {
                const ignoreLabel = isMarkingIgnored
                  ? "..."
                  : post.ignored
                    ? "Unignore"
                    : "Ignore";
                menuItems.push({
                  label: ignoreLabel,
                  node: (
                    <button
                      key="ignore"
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
                      {ignoreLabel}
                    </button>
                  ),
                });
              }
              if (onMarkUsedChange) {
                const usedLabel = isMarkingUsed
                  ? "..."
                  : post.used_on_episode
                    ? "Mark as unused"
                    : "Mark as used";
                menuItems.push({
                  label: usedLabel,
                  node: (
                    <button
                      key="mark-used"
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-foreground hover:bg-surface-hover disabled:opacity-50"
                      disabled={isMarkingUsed}
                      role="menuitem"
                      type="button"
                      onClick={() => {
                        closeMenu();
                        onMarkUsedChange(post.id, !post.used_on_episode);
                      }}
                    >
                      <Check aria-hidden className="h-4 w-4" />
                      {usedLabel}
                    </button>
                  ),
                });
              }
              if (post.url) {
                if (queueStatus && activeJobId && onCancelRefresh) {
                  const cancelLabel = isCancellingRefresh ? "Cancelling…" : "Cancel Refresh";
                  menuItems.push({
                    label: cancelLabel,
                    node: (
                      <button
                        key="cancel-refresh"
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
                        {cancelLabel}
                      </button>
                    ),
                  });
                } else if (onQueueRefresh) {
                  const refreshLabel = isQueuingRefresh ? "Queuing…" : "Refresh Post";
                  menuItems.push({
                    label: refreshLabel,
                    node: (
                      <button
                        key="refresh-post"
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
                        {refreshLabel}
                      </button>
                    ),
                  });
                }
              }
              menuItems.sort((a, b) => a.label.localeCompare(b.label, "en", { sensitivity: "base" }));
              return (
                <div
                  className="border-border bg-surface absolute right-0 top-full z-10 mt-1 min-w-[11rem] rounded-card border py-1 shadow-lg"
                  role="menu"
                >
                  {menuItems.map((item) => item.node)}
                </div>
              );
            })()}
          </div>
        </>
      )}
    </div>
  );

  return (
    <Card className="px-4 py-5 transition-colors hover:border-border-focus">
      {/* Top: score + author + neighborhood + actions; then category badges full width */}
      <div className="mb-4 sm:mb-6">
        <div className="flex min-w-0 items-stretch gap-2 sm:gap-3">
          {/* Score badge: spans both rows vertically (column stretches, circle centered) */}
          {scores?.final_score != null && (
            <div className="flex shrink-0 items-center">
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
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            {/* Row 1: author and date (left) + action icons (upper right) */}
            <div className="flex min-w-0 items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-x-2">
                <span className="text-foreground text-sm">
                  {post.author_name?.trim() || "Unknown"}
                </span>
                <span className="text-muted-foreground text-sm">•</span>
                <span className="text-foreground text-sm font-medium tracking-wide">
                  {formatRelativeTime(post.created_at)}
                </span>
              </div>
              {actionsBlock}
            </div>
            {/* Row 2: reaction count, comment count (always show with 0 if none), then optional similarity */}
            <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
              <span
                className="text-foreground inline-flex items-center gap-1 text-sm"
                title="Reactions on Nextdoor"
              >
                <ThumbsUp
                  aria-hidden
                  className="h-3.5 w-3.5 shrink-0"
                />
                {typeof post.reaction_count === "number" ? post.reaction_count : 0}
              </span>
              <span className="text-muted-foreground text-sm">•</span>
              <Link
                className="text-foreground inline-flex items-center gap-1 text-sm hover:underline"
                href={`/posts/${post.id}#comments`}
                title="View comments"
              >
                <MessageSquare
                  aria-hidden
                  className="h-3.5 w-3.5 shrink-0"
                />
                {Array.isArray(post.comments) ? post.comments.length : 0}
              </Link>
              {post.similarity != null && (
                <>
                  <span className="text-muted-foreground text-sm">•</span>
                  <span
                    className="rounded border border-orange-500/60 bg-orange-500/15 px-1.5 py-0.5 text-orange-400 text-xs font-medium"
                    title="Semantic similarity to search query"
                  >
                    {post.similarity.toFixed(2)}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>
        {/* Full-width row: categories first, then statuses (no headers) */}
        {(categoriesToShow.length > 0 ||
          post.ignored ||
          post.used_on_episode ||
          queueStatus === "pending" ||
          queueStatus === "running") && (
          <div className="mt-3 flex w-full flex-wrap items-center gap-1.5">
            {categoriesToShow.map((category: string, index: number) => (
              <span
                key={`${category}-${index}`}
                className="rounded-md border border-white/25 bg-surface-hover/80 px-2 py-0.5 text-foreground/90 text-xs font-medium"
              >
                {formatCategoryLabel(category)}
              </span>
            ))}
            {post.ignored && (
              <span className="rounded border border-slate-500/60 bg-slate-500/15 px-2 py-0.5 text-slate-400 text-xs font-medium">
                Ignored
              </span>
            )}
            {post.used_on_episode && (
              <span className="rounded border border-violet-500/60 bg-violet-500/15 px-2 py-0.5 text-violet-400 text-xs font-medium">
                Used
              </span>
            )}
            {queueStatus === "pending" && (
              <span className="rounded border border-amber-500/60 bg-amber-500/15 px-2 py-0.5 text-amber-400 text-xs font-medium">
                Queued
              </span>
            )}
            {queueStatus === "running" && (
              <span className="rounded border border-blue-500/60 bg-blue-500/15 px-2 py-0.5 text-blue-400 text-xs font-medium">
                Processing
              </span>
            )}
          </div>
        )}
      </div>

      {/* Details: neighborhood and any other details (similarity is in header row 2) */}
      {neighborhoodName && (
        <div className="mb-6">
          <h3 className="text-foreground mb-4 text-base font-semibold uppercase tracking-wide">
            Details
          </h3>
          <div className="grid grid-cols-2 gap-x-6 gap-y-4">
            <div className="flex flex-col gap-1.5">
              <span className="text-foreground text-xs font-semibold uppercase tracking-wide">
                Neighborhood
              </span>
              <span
                className="text-foreground min-w-0 break-words text-xs"
                style={{ opacity: 0.85 }}
              >
                {neighborhoodName}
              </span>
            </div>
          </div>
        </div>
      )}

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
