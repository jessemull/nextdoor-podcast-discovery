import Image from "next/image";
import Link from "next/link";

import {
  PODCAST_ENTRANCE_CLASS,
  podcastEntranceDelayMs,
} from "@/lib/podcast-entrance-animation";
import { searchEpisodesPublishedSafe } from "@/lib/podcast.server";

import type { Metadata } from "next";

export const metadata: Metadata = {
  description: "Search podcast episodes.",
  title: "Search | Podcast",
};

const EPISODES_PER_PAGE = 20;

interface SearchPageProps {
  searchParams: Promise<{ q?: string }>;
}

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const { q } = await searchParams;
  const query = (q ?? "").trim();
  const episodes = query
    ? await searchEpisodesPublishedSafe(query, EPISODES_PER_PAGE, 0)
    : [];

  return (
    <div className="mx-auto max-w-6xl px-5 py-12 sm:px-7">
      <div
        className={PODCAST_ENTRANCE_CLASS}
        style={{ animationDelay: "0ms" }}
      >
        <h1 className="text-foreground mb-6 text-2xl font-bold">Search</h1>
      </div>
      <div
        className={PODCAST_ENTRANCE_CLASS}
        style={{ animationDelay: "80ms" }}
      >
        <p className="text-muted mb-6 text-sm">
          Use the search box in the header, or add <code className="rounded bg-surface-hover px-1 py-0.5">?q=...</code> to
          the URL to search episodes by title and description.
        </p>
      </div>
      {query ? (
        <div
          className={PODCAST_ENTRANCE_CLASS}
          style={{ animationDelay: "160ms" }}
        >
          <p className="text-muted mb-4 text-sm">
            Results for &quot;{query}&quot;: {episodes.length} episode
            {episodes.length !== 1 ? "s" : ""} found.
          </p>
        </div>
      ) : null}
      {query && episodes.length > 0 ? (
        <ul className="space-y-4">
          {episodes.map((ep, index) => (
            <li
              key={ep.id}
              className={PODCAST_ENTRANCE_CLASS}
              style={{
                animationDelay: `${podcastEntranceDelayMs(index)}ms`,
              }}
            >
              <Link
                className="border-border bg-surface-hover/30 flex gap-4 rounded-lg border p-4 transition-colors hover:border-border-focus"
                href={`/episodes/${ep.slug}`}
              >
                {ep.image_url ? (
                  <Image
                    alt=""
                    className="h-20 w-20 shrink-0 rounded object-cover"
                    height={80}
                    src={ep.image_url}
                    unoptimized
                    width={80}
                  />
                ) : (
                  <div className="bg-surface-hover h-20 w-20 shrink-0 rounded" />
                )}
                <div className="min-w-0 flex-1">
                  <h2 className="text-foreground font-semibold">{ep.title}</h2>
                  {ep.published_at && (
                    <time
                      className="text-muted text-sm"
                      dateTime={ep.published_at}
                    >
                      {new Date(ep.published_at).toLocaleDateString()}
                    </time>
                  )}
                  {ep.description && (
                    <p className="text-muted mt-1 line-clamp-2 text-sm">
                      {ep.description}
                    </p>
                  )}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      ) : query ? (
        <div
          className={PODCAST_ENTRANCE_CLASS}
          style={{ animationDelay: "200ms" }}
        >
          <p className="text-muted">No episodes match your search.</p>
        </div>
      ) : null}
    </div>
  );
}
