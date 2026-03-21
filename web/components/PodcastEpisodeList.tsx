"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useMemo } from "react";

import { PodcastAudioPlayer } from "@/components/PodcastAudioPlayer";
import { formatDuration } from "@/lib/format-duration";

import type { PodcastEpisodeSummary } from "@/lib/podcast.types";

interface PodcastEpisodeListProps {
  episodes: PodcastEpisodeSummary[];
}

function filterEpisodes(
  episodes: PodcastEpisodeSummary[],
  query: string
): PodcastEpisodeSummary[] {
  const q = query.trim().toLowerCase();
  if (!q) return episodes;
  return episodes.filter((ep) => {
    const title = (ep.title ?? "").toLowerCase();
    const desc = (ep.description ?? "").toLowerCase();
    return title.includes(q) || desc.includes(q);
  });
}

export function PodcastEpisodeList({ episodes }: PodcastEpisodeListProps) {
  const searchParams = useSearchParams();
  const q = searchParams.get("q") ?? "";

  const filtered = useMemo(
    () => filterEpisodes(episodes, q),
    [episodes, q]
  );

  if (episodes.length === 0) {
    return (
      <p className="text-podcast-muted">
        No episodes yet. Check back soon.
      </p>
    );
  }

  if (filtered.length === 0) {
    return (
      <p className="text-podcast-muted">
        No episodes match your search. Try different keywords.
      </p>
    );
  }

  return (
    <ul className="space-y-8">
      {filtered.map((ep, index) => (
        <li key={ep.id}>
          <div className="mb-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-white">
            {ep.published_at && (
              <span className="flex items-center gap-1.5">
                <svg
                  aria-hidden
                  className="text-podcast-accent h-4 w-4 shrink-0"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  viewBox="0 0 24 24"
                >
                  <path
                    d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                <time dateTime={ep.published_at}>
                  {new Date(ep.published_at).toLocaleDateString("en-US", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
                </time>
              </span>
            )}
            {ep.duration_seconds != null && (
              <span className="flex items-center gap-1.5">
                <svg
                  aria-hidden
                  className="text-podcast-accent h-4 w-4 shrink-0"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  viewBox="0 0 24 24"
                >
                  <path
                    d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                {formatDuration(ep.duration_seconds)}
              </span>
            )}
          </div>
          <Link
            className="text-podcast-foreground hover:text-podcast-accent block text-2xl font-bold transition-colors focus:outline-none focus:ring-2 focus:ring-podcast-accent focus:ring-offset-2 focus:ring-offset-[var(--background)]"
            href={`/episodes/${ep.slug}`}
          >
            {ep.title}
          </Link>
          {ep.description && (
            <p className="mt-2 line-clamp-2 text-base text-[#9fb7c4]">
              {ep.description}
            </p>
          )}
          {index === 0 && ep.audio_url && (
            <div className="mt-4">
              <PodcastAudioPlayer
                key={ep.audio_url}
                className="w-full"
                durationSeconds={ep.duration_seconds}
                src={ep.audio_url}
              />
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}
