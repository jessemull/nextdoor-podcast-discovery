import Image from "next/image";
import Link from "next/link";

import {
  getEpisodesPublishedSafe,
  getPodcastCategoriesSafe,
} from "@/lib/podcast.server";
import { siteBaseUrl } from "@/lib/site-url.server";

import type { Metadata } from "next";

export const metadata: Metadata = {
  description: "Discover podcast episodes and browse by category.",
  openGraph: {
    description: "Discover podcast episodes and browse by category.",
    title: "Podcast | Nextdoor",
    type: "website",
    url: "/",
  },
  title: "Podcast | Nextdoor",
  twitter: {
    card: "summary_large_image",
    description: "Discover podcast episodes and browse by category.",
    title: "Podcast | Nextdoor",
  },
};

export const revalidate = 60;

export default async function PodcastHomePage() {
  const [episodes, categories] = await Promise.all([
    getEpisodesPublishedSafe(10, 0),
    getPodcastCategoriesSafe(),
  ]);
  const latestEpisode = episodes[0] ?? null;

  const base = siteBaseUrl;
  const seriesJsonLd = {
    "@context": "https://schema.org",
    "@type": "PodcastSeries",
    description: "Discover podcast episodes and browse by category.",
    name: "Podcast",
    url: base,
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <script
        dangerouslySetInnerHTML={{ __html: JSON.stringify(seriesJsonLd) }}
        type="application/ld+json"
      />
      {/* Hero: latest episode */}
      {latestEpisode ? (
        <section aria-label="Latest episode" className="mb-12">
          <Link
            className="block rounded-lg border border-border bg-surface-hover/50 p-6 transition-colors hover:border-border-focus sm:p-8"
            href={`/episodes/${latestEpisode.slug}`}
          >
            <span className="text-muted-foreground mb-2 inline-block text-sm font-medium uppercase tracking-wide">
              Latest Episode
            </span>
            <h1 className="text-foreground mb-3 text-2xl font-bold tracking-tight sm:text-3xl">
              {latestEpisode.title}
            </h1>
            {latestEpisode.description && (
              <p className="text-muted line-clamp-2 max-w-2xl text-base">
                {latestEpisode.description}
              </p>
            )}
            <span className="text-muted mt-3 inline-block text-sm">
              Listen now
            </span>
          </Link>
        </section>
      ) : (
        <section aria-label="Welcome" className="mb-12 text-center">
          <h1 className="text-foreground mb-4 text-3xl font-bold tracking-tight sm:text-4xl">
            Welcome to the Podcast
          </h1>
          <p className="text-muted mx-auto max-w-2xl text-lg">
            Episode discovery, show notes, and more coming soon.
          </p>
        </section>
      )}

      {/* Recent episodes */}
      <section aria-label="Recent episodes" className="mb-12">
        <h2 className="text-foreground mb-4 text-xl font-semibold">
          Recent Episodes
        </h2>
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
                    <h3 className="text-foreground font-medium">{ep.title}</h3>
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
        ) : (
          <p className="text-muted">No episodes yet. Check back soon.</p>
        )}
      </section>

      {/* Explore by category */}
      <section aria-label="Explore by category">
        <h2 className="text-foreground mb-4 text-xl font-semibold">
          Explore by Category
        </h2>
        {categories.length > 0 ? (
          <ul className="flex flex-wrap gap-3">
            {categories.map((cat) => (
              <li key={cat.id}>
                <Link
                  className="border-border bg-surface-hover/50 rounded-lg border px-4 py-2 text-sm font-medium text-foreground transition-colors hover:border-border-focus"
                  href={`/categories/${cat.slug}`}
                >
                  {cat.name}
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-muted">No categories yet.</p>
        )}
      </section>
    </div>
  );
}
