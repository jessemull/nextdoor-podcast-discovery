"use client";

import { PostWithScores } from "@/lib/types";
import { formatRelativeTime, truncate } from "@/lib/utils";

interface PostCardProps {
  post: PostWithScores;
  onMarkUsed?: (postId: string) => void;
}

export function PostCard({ post, onMarkUsed }: PostCardProps) {
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
      <p className="text-gray-200 mb-3">{truncate(post.text, 300)}</p>

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
          {scores.tags.map((tag) => (
            <span
              key={tag}
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
          "{scores.summary}"
        </p>
      )}

      {/* Actions */}
      <div className="flex gap-2">
        <button className="text-xs text-gray-400 hover:text-white transition-colors">
          View Details
        </button>
        {!ranking?.used_on_episode && onMarkUsed && (
          <button
            onClick={() => onMarkUsed(post.id)}
            className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
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
 */
function ScoreBadge({ label, value }: { label: string; value: number }) {
  const getColor = (v: number) => {
    if (v >= 8) return "text-green-400";
    if (v >= 6) return "text-yellow-400";
    if (v >= 4) return "text-orange-400";
    return "text-red-400";
  };

  return (
    <span className="text-xs text-gray-400">
      {label}: <span className={getColor(value)}>{value.toFixed(1)}</span>
    </span>
  );
}
