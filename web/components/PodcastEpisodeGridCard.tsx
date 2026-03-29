import Image from "next/image";
import Link from "next/link";

import type { PodcastEpisodeSummary } from "@/lib/podcast.types";

export type PodcastEpisodeGridCardEpisode = Pick<
  PodcastEpisodeSummary,
  "image_url" | "published_at" | "slug" | "title"
>;

interface PodcastEpisodeGridCardProps {
  episode: PodcastEpisodeGridCardEpisode;
}

/**
 * Grid card for episode links (related episodes, category listings, etc.).
 */
export function PodcastEpisodeGridCard({ episode }: PodcastEpisodeGridCardProps) {
  const ep = episode;
  return (
    <Link
      className="bg-surface-hover/30 group flex h-full flex-col rounded-lg border border-podcast-accent p-3 transition-colors hover:bg-surface-hover/50 hover:border-podcast-accent sm:p-3.5"
      href={`/episodes/${ep.slug}`}
    >
      <div className="relative h-32 w-full shrink-0 overflow-hidden rounded-md bg-surface-hover sm:h-36">
        {ep.image_url ? (
          <Image
            alt=""
            className="object-cover transition-transform duration-300 group-hover:scale-[1.02]"
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            src={ep.image_url}
            unoptimized
          />
        ) : (
          <div
            aria-hidden
            className="h-full w-full bg-gradient-to-br from-surface-hover to-background"
          />
        )}
      </div>
      <div className="mt-3 flex min-h-0 flex-1 flex-col gap-1.5">
        <h3 className="text-podcast-foreground line-clamp-2 text-base font-bold leading-snug">
          {ep.title}
        </h3>
        {ep.published_at ? (
          <div className="flex items-center gap-1.5 text-sm text-white">
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
          </div>
        ) : null}
      </div>
    </Link>
  );
}
