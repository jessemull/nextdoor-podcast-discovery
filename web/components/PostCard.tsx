"use client";

import { PostWithScores } from "@/lib/types";
import { cn, formatRelativeTime, POST_PREVIEW_LENGTH, truncate } from "@/lib/utils";

interface PostCardProps {
  onMarkUsed?: (postId: string) => void;
  onViewDetails?: (postId: string) => void;
  post: PostWithScores;
}

export function PostCard({ onMarkUsed, onViewDetails, post }: PostCardProps) {
  const scores = post.llm_scores;
  const ranking = post.rankings;

  return (
    <div className="bg-gray-800 rounded-lg p-4 border border-gray-700 hover:border-gray-600 transition-colors">
      {/* Header */}
      <div className="flex justify-between items-start mb-3">
        <div>
          <span className="text-xs text-gray-500 uppercase tracking-wide">
            {post.neighborhood?.name || "Unknown"}
          </span>
          <span className="text-xs text-gray-600 mx-2">•</span>
          <span className="text-xs text-gray-500">
            {formatRelativeTime(post.posted_at)}
          </span>
        </div>
        {ranking && (
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-yellow-500">
              {ranking.final_score.toFixed(1)}
            </span>
            {ranking.used_on_episode && (
              <span className="text-xs bg-green-800 text-green-200 px-2 py-0.5 rounded">
                Used
              </span>
            )}
          </div>
        )}
      </div>

      {/* Content */}
      <p className="text-gray-200 mb-3">
        {truncate(post.text, POST_PREVIEW_LENGTH)}
      </p>

      {/* Scores */}
      {scores && (
        <div className="flex flex-wrap gap-2 mb-3">
          <ScoreBadge label="Absurd" value={scores.absurdity} />
          <ScoreBadge label="Humor" value={scores.humor} />
          <ScoreBadge label="Drama" value={scores.drama} />
          <ScoreBadge label="Relate" value={scores.relatability} />
        </div>
      )}

      {/* Tags */}
      {scores?.tags && scores.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-3">
          {scores.tags.map((tag, index) => (
            <span
              key={`${tag}-${index}`}
              className="text-xs bg-gray-700 text-gray-300 px-2 py-0.5 rounded"
            >
              {tag}
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
        {!ranking?.used_on_episode && onMarkUsed && (
          <button
            aria-label="Mark this post as used in an episode"
            className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
            onClick={() => onMarkUsed(post.id)}
          >
            Mark as Used
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * Internal component for displaying individual score metrics.
 * Color-coded based on score value (green=high, red=low).
 * Handles null values gracefully.
 */
function ScoreBadge({ label, value }: { label: string; value: null | number }) {
  if (value === null) {
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
