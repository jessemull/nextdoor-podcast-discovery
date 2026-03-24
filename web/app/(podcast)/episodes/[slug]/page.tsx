import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import { PodcastAudioPlayer } from "@/components/PodcastAudioPlayer";
import { formatDuration } from "@/lib/format-duration";
import {
  getEpisodeBySlugSafe,
  getSimilarEpisodesSafe,
} from "@/lib/podcast.server";
import { siteBaseUrl } from "@/lib/site-url.server";

import type { Metadata } from "next";

interface EpisodePageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({
  params,
}: EpisodePageProps): Promise<Metadata> {
  const { slug } = await params;
  const episode = await getEpisodeBySlugSafe(slug);
  if (!episode) {
    return { title: "Episode Not Found" };
  }
  return {
    description: episode.description ?? undefined,
    openGraph: {
      description: episode.description ?? undefined,
      images: episode.image_url
        ? [
            {
              alt: episode.image_description ?? undefined,
              url: episode.image_url,
            },
          ]
        : undefined,
      title: episode.title,
      type: "article",
    },
    title: `${episode.title} | Podcast`,
    twitter: {
      card: "summary_large_image",
      description: episode.description ?? undefined,
      images: episode.image_url ? [episode.image_url] : undefined,
      title: episode.title,
    },
  };
}

export const revalidate = 60;

export default async function EpisodePage({ params }: EpisodePageProps) {
  const { slug } = await params;
  const episode = await getEpisodeBySlugSafe(slug);
  if (!episode) {
    notFound();
  }

  const similar = await getSimilarEpisodesSafe(episode.id, 6);

  const episodeUrl = `${siteBaseUrl}/episodes/${episode.slug}`;
  const episodeJsonLd = {
    "@context": "https://schema.org",
    "@type": "PodcastEpisode",
    datePublished: episode.published_at ?? undefined,
    description: episode.description ?? undefined,
    image: episode.image_url ?? undefined,
    name: episode.title,
    url: episodeUrl,
    ...(episode.audio_url && {
      associatedMedia: {
        "@type": "MediaObject",
        contentUrl: episode.audio_url,
      },
    }),
    ...(episode.duration_seconds != null && {
      timeRequired: `PT${episode.duration_seconds}S`,
    }),
  };

  return (
    <div className="mx-auto max-w-6xl px-5 pb-12 pt-8 sm:px-7 sm:pt-12">
      <script
        dangerouslySetInnerHTML={{ __html: JSON.stringify(episodeJsonLd) }}
        type="application/ld+json"
      />
      <article>
        {/* Hero */}
        <header>
          <h1 className="text-podcast-foreground block pb-3 text-4xl font-bold">
            {episode.title}
          </h1>
          <div className="mb-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-white">
            {episode.published_at && (
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
                <time dateTime={episode.published_at}>
                  {new Date(episode.published_at).toLocaleDateString("en-US", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
                </time>
              </span>
            )}
            {episode.duration_seconds != null && (
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
                {formatDuration(episode.duration_seconds)}
              </span>
            )}
          </div>
        </header>

        {episode.description && (
          <p className="mt-2 whitespace-pre-wrap text-base text-[#9fb7c4]">
            {episode.description}
          </p>
        )}

        {/* Audio player */}
        {episode.audio_url && (
          <div className="mt-4">
            <PodcastAudioPlayer
              key={episode.audio_url}
              className="w-full"
              durationSeconds={episode.duration_seconds}
              src={episode.audio_url}
            />
          </div>
        )}

        {episode.image_url && (
          <div className="relative mb-8 mt-8 sm:mt-12 aspect-video overflow-hidden rounded-lg">
            <Image
              alt={episode.image_description ?? ""}
              className="object-cover"
              fill
              sizes="(max-width: 768px) 100vw, 800px"
              src={episode.image_url}
              unoptimized
            />
          </div>
        )}
        {episode.image_description && (
          <p className="text-podcast-muted mb-8 -mt-4 text-sm">
            {episode.image_description}
          </p>
        )}

      </article>

      {/* Related episodes */}
      {similar.length > 0 && (
        <aside aria-label="Related episodes" className="mt-4 sm:mt-12 border-t border-border pt-4 sm:pt-8">
          <h2 className="text-foreground mb-4 text-xl font-semibold">
            Related Episodes
          </h2>
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {similar.map((ep) => (
              <li key={ep.id}>
                <Link
                  className="bg-surface-hover/30 flex gap-3 rounded-lg border border-podcast-accent p-3 transition-colors hover:bg-surface-hover/50 hover:border-podcast-accent"
                  href={`/episodes/${ep.slug}`}
                >
                  {ep.image_url ? (
                    <Image
                      alt=""
                      className="h-16 w-16 shrink-0 rounded object-cover"
                      height={64}
                      src={ep.image_url}
                      unoptimized
                      width={64}
                    />
                  ) : (
                    <div className="bg-surface-hover h-16 w-16 shrink-0 rounded" />
                  )}
                  <div className="min-w-0 flex-1">
                    <h3 className="text-podcast-foreground line-clamp-2 text-base font-bold leading-snug">
                      {ep.title}
                    </h3>
                    {ep.published_at && (
                      <div className="mt-1 flex items-center gap-1.5 text-sm text-white">
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
                    )}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </aside>
      )}
    </div>
  );
}
