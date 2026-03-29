"use client";

import { Mic } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useMemo } from "react";

import { PodcastAudioPlayer } from "@/components/PodcastAudioPlayer";
import { PodcastEpisodeCategoryChips } from "@/components/PodcastEpisodeCategoryChips";
import { formatDuration } from "@/lib/format-duration";
import {
  PODCAST_ENTRANCE_CLASS,
  podcastEntranceDelayMs,
} from "@/lib/podcast-entrance-animation";
import { filterPodcastEpisodesByQuery } from "@/lib/podcast-filter";

import type { PodcastEpisodeSummary } from "@/lib/podcast.types";

interface PodcastEpisodeListProps {
  episodes: PodcastEpisodeSummary[];
}

export function PodcastEpisodeList({ episodes }: PodcastEpisodeListProps) {
  const searchParams = useSearchParams();
  const q = searchParams.get("q") ?? "";

  const filtered = useMemo(
    () => filterPodcastEpisodesByQuery(episodes, q),
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
      <div
        aria-live="polite"
        className="flex flex-col items-center justify-center gap-4 px-4 pb-4 pt-10 text-center md:justify-start md:min-h-0 md:gap-6 md:pb-8 md:pt-16"
        role="status"
      >
        <Mic
          aria-hidden
          className="text-podcast-accent/80 h-12 w-12 shrink-0 sm:h-14 sm:w-14"
          strokeWidth={1.25}
        />
        <div className="max-w-md space-y-2">
          <p className="text-podcast-foreground text-lg font-medium">
            No episodes match your search.
          </p>
          <p className="text-podcast-muted text-sm">
            Try different keywords or clear your search.
          </p>
        </div>
      </div>
    );
  }

  return (
    <ul className="space-y-9">
      {filtered.map((ep, index) => (
        <li key={ep.id}>
          <div
            className={PODCAST_ENTRANCE_CLASS}
            style={{
              animationDelay: `${podcastEntranceDelayMs(index)}ms`,
            }}
          >
            {(ep.published_at || ep.duration_seconds != null) && (
              <div className="mb-2.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-white">
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
            )}
            <Link
              className="text-podcast-foreground hover:text-podcast-accent block text-2xl font-bold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-podcast-muted/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)]"
              href={`/episodes/${ep.slug}`}
            >
              {ep.title}
            </Link>
            {ep.description && (
              <p className="mt-2 line-clamp-2 text-base text-[#9fb7c4]">
                {ep.description}
              </p>
            )}
            {ep.audio_url ? (
              <div className="mt-4">
                <PodcastAudioPlayer
                  key={ep.id}
                  className="w-full"
                  durationSeconds={ep.duration_seconds}
                  src={ep.audio_url}
                />
              </div>
            ) : null}
            {ep.categories.length > 0 ? (
              <div
                className={`flex flex-wrap items-center gap-x-2 gap-y-1 ${
                  ep.audio_url
                    ? "mt-5"
                    : ep.description
                      ? "mt-3"
                      : "mt-2.5"
                }`}
              >
                <span className="font-medium inline-block origin-center scale-y-[1.07] shrink-0 text-xs tracking-wider text-white/70 uppercase">
                  Categories
                </span>
                <PodcastEpisodeCategoryChips categories={ep.categories} />
              </div>
            ) : null}
          </div>
        </li>
      ))}
    </ul>
  );
}
