import Image from "next/image";
import Link from "next/link";

import { getEpisodesPublishedSafe } from "@/lib/podcast.server";

import type { Metadata } from "next";

export const metadata: Metadata = {
  description: "Browse all podcast episodes.",
  title: "Episodes | Podcast",
};

export const revalidate = 60;

export default async function EpisodesPage() {
  const episodes = await getEpisodesPublishedSafe(50, 0);

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      <h1 className="text-foreground mb-6 text-2xl font-bold">Episodes</h1>
      {episodes.length > 0 ? (
        <ul className="space-y-4">
          {episodes.map((ep) => (
            <li key={ep.id}>
              <Link
                className="border-border bg-surface-hover/30 flex gap-4 rounded-lg border p-4 transition-colors hover:border-border-focus"
                href={`/episodes/${ep.slug}`}
              >
                {ep.image_url ? (
                  <Image
                    alt=""
                    className="h-24 w-24 shrink-0 rounded object-cover"
                    height={96}
                    src={ep.image_url}
                    unoptimized
                    width={96}
                  />
                ) : (
                  <div className="bg-surface-hover h-24 w-24 shrink-0 rounded" />
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
                  {ep.duration_seconds != null && (
                    <span className="text-muted ml-2 text-sm">
                      {Math.floor(ep.duration_seconds / 60)} min
                    </span>
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
      ) : (
        <p className="text-muted">No episodes yet. Check back soon.</p>
      )}
    </div>
  );
}
