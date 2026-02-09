"use client";

import Image from "next/image";
import { memo } from "react";

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
  const dimensionScores = scores?.scores;

  return (
    <div className="bg-gray-800 rounded-lg p-4 border border-gray-700 hover:border-gray-600 transition-colors">
      {/* Header */}
      <div className="flex justify-between items-start mb-3">
        <div className="flex items-center gap-2">
          {showCheckbox && onSelect && (
            <input
              aria-label={`Select post from ${post.neighborhood?.name || "unknown"}`}
              checked={selected}
              className="rounded border-gray-600 bg-gray-700"
              type="checkbox"
              onChange={(e) => onSelect(post.id, e.target.checked)}
            />
          )}
          <div>
          <span className="text-xs text-gray-500 uppercase tracking-wide">
            {post.neighborhood?.name || "Unknown"}
          </span>
          <span className="text-xs text-gray-600 mx-2">•</span>
          <span className="text-xs text-gray-500">
            {formatRelativeTime(post.created_at)}
          </span>
          {typeof post.reaction_count === "number" && post.reaction_count > 0 && (
            <>
              <span className="text-xs text-gray-600 mx-2">•</span>
              <span
                className="text-xs text-gray-400"
                title="Reactions on Nextdoor"
              >
                {post.reaction_count} reaction{post.reaction_count !== 1 ? "s" : ""}
              </span>
            </>
          )}
          </div>
        </div>
        {(scores || post.similarity != null) && (
          <div className="flex items-center gap-2">
            {scores && (
              <span className="text-sm font-bold text-yellow-500">
                {scores.final_score?.toFixed(1) ?? "—"}
              </span>
            )}
            {post.similarity != null && (
              <span
                className="text-xs text-gray-400"
                title="Semantic similarity to search query"
              >
                Sim: {post.similarity.toFixed(2)}
              </span>
            )}
            {post.ignored && (
              <span className="rounded bg-gray-700 px-2 py-0.5 text-xs text-gray-300">
                Ignored
              </span>
            )}
            {post.saved && (
              <span className="rounded bg-blue-800 px-2 py-0.5 text-xs text-blue-200">
                Saved
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
                className="h-24 w-24 rounded border border-gray-700 object-cover transition-colors hover:border-gray-600"
                height={96}
                sizes="96px"
                src={imageUrl}
                width={96}
              />
            </a>
          ))}
          {post.image_urls.length > 4 && (
            <div className="flex h-24 w-24 items-center justify-center rounded border border-gray-700 bg-gray-700 text-xs text-gray-400">
              +{post.image_urls.length - 4}
            </div>
          )}
        </div>
      )}

      {/* Content */}
      <p className="text-gray-200 mb-3">
        {truncate(post.text, POST_PREVIEW_LENGTH)}
      </p>

      {/* Scores */}
      {dimensionScores && (
        <div className="flex flex-wrap gap-2 mb-3">
          <ScoreBadge label="Absurd" value={dimensionScores.absurdity} />
          <ScoreBadge label="Drama" value={dimensionScores.drama} />
          <ScoreBadge label="Discuss" value={dimensionScores.discussion_spark} />
          <ScoreBadge label="Intense" value={dimensionScores.emotional_intensity} />
          <ScoreBadge label="News" value={dimensionScores.news_value} />
          {dimensionScores.readability != null && (
            <ScoreBadge label="Read" value={dimensionScores.readability} />
          )}
          {dimensionScores.podcast_worthy != null && (
            <ScoreBadge label="Podcast" value={dimensionScores.podcast_worthy} />
          )}
        </div>
      )}

      {/* Categories */}
      {scores?.categories && scores.categories.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-3">
          {scores.categories.map((category: string, index: number) => (
            <span
              key={`${category}-${index}`}
              className="text-xs bg-gray-700 text-gray-300 px-2 py-0.5 rounded"
            >
              {category}
            </span>
          ))}
        </div>
      )}

      {/* Summary */}
      {scores?.summary && (
        <p className="text-sm text-gray-400 italic mb-3">
          &ldquo;{scores.summary}&rdquo;
        </p>
      )}

      {/* Why podcast worthy */}
      {scores?.why_podcast_worthy && (
        <p className="text-sm text-amber-200/90 mb-3">
          {scores.why_podcast_worthy}
        </p>
      )}

      {/* Actions */}
      <div className="flex gap-2">
        {onViewDetails && (
          <button
            aria-label={`View details for post from ${post.neighborhood?.name || "unknown neighborhood"}`}
            className="text-xs text-gray-400 hover:text-white transition-colors"
            onClick={() => onViewDetails(post.id)}
          >
            View Details
          </button>
        )}
        <a
          className="text-xs text-gray-400 hover:text-white transition-colors"
          href={`/search?q=${encodeURIComponent(
            (post.text || post.llm_scores?.summary || "").slice(0, 80)
          )}`}
        >
          Find similar
        </a>
        {post.url && (
          <a
            aria-label="View on Nextdoor"
            className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
            href={post.url}
            rel="noopener noreferrer"
            target="_blank"
          >
            View on Nextdoor
          </a>
        )}
        {onMarkSaved && (
          <button
            aria-label={post.saved ? "Remove from saved" : "Save for episode"}
            className="text-xs text-blue-400 transition-colors hover:text-blue-300 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={isMarkingSaved}
            onClick={() => onMarkSaved(post.id, !post.saved)}
          >
            {isMarkingSaved ? "Saving..." : post.saved ? "Unsave" : "Save"}
          </button>
        )}
        {onMarkIgnored && (
          <button
            aria-label={post.ignored ? "Unignore this post" : "Ignore this post"}
            className="text-xs text-gray-400 transition-colors hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
            disabled={isMarkingIgnored}
            onClick={() => onMarkIgnored(post.id, !post.ignored)}
          >
            {isMarkingIgnored
              ? "..."
              : post.ignored
                ? "Unignore"
                : "Ignore"}
          </button>
        )}
        {!post.used_on_episode && onMarkUsed && (
          <button
            aria-label="Mark this post as used in an episode"
            className="text-xs text-green-400 transition-colors hover:text-green-300 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={isMarkingUsed}
            onClick={() => onMarkUsed(post.id)}
          >
            {isMarkingUsed ? "Marking..." : "Mark as Used"}
          </button>
        )}
      </div>
    </div>
  );
});

/**
 * Internal component for displaying individual score metrics.
 * Color-coded based on score value (green=high, red=low).
 * Handles null/undefined values gracefully.
 */
function ScoreBadge({ label, value }: { label: string; value: null | number | undefined }) {
  if (value === null || value === undefined) {
    return (
      <span className="text-xs text-gray-400">
        {label}: <span className="text-gray-500">—</span>
      </span>
    );
  }

  const colorClass = cn(
    value >= 8 && "text-green-400",
    value >= 6 && value < 8 && "text-yellow-400",
    value >= 4 && value < 6 && "text-orange-400",
    value < 4 && "text-red-400"
  );

  return (
    <span className="text-xs text-gray-400">
      {label}: <span className={colorClass}>{value.toFixed(1)}</span>
    </span>
  );
}
