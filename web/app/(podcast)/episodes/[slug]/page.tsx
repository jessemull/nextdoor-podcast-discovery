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
  const firstGallery = episode.episode_images?.find((i) => i.image_url);
  const ogImageUrl = firstGallery?.image_url ?? episode.image_url ?? undefined;
  const ogImageAlt =
    firstGallery?.description ?? episode.image_description ?? undefined;

  return {
    description: episode.description ?? undefined,
    openGraph: {
      description: episode.description ?? undefined,
      images: ogImageUrl
        ? [
            {
              alt: ogImageAlt ?? undefined,
              url: ogImageUrl,
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
      images: ogImageUrl ? [ogImageUrl] : undefined,
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

  const galleryWithUrl =
    episode.episode_images?.filter((i) => i.image_url) ?? [];
  const galleryForDisplay =
    galleryWithUrl.length > 0
      ? galleryWithUrl
      : episode.image_url
        ? [
            {
              description: episode.image_description,
              id: "legacy",
              image_url: episode.image_url,
              sort_order: 0,
            },
          ]
        : [];

  const episodeUrl = `${siteBaseUrl}/episodes/${episode.slug}`;
  const jsonLdImages = galleryForDisplay.map((i) => i.image_url).filter(Boolean);
  const episodeJsonLd = {
    "@context": "https://schema.org",
    "@type": "PodcastEpisode",
    datePublished: episode.published_at ?? undefined,
    description: episode.description ?? undefined,
    image:
      jsonLdImages.length > 1
        ? jsonLdImages
        : jsonLdImages[0] ?? undefined,
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

        {galleryForDisplay.length > 0 && (
          <div className="mt-8 space-y-8 sm:mt-12">
            {galleryForDisplay.map((img) => (
              <div key={img.id}>
                {img.image_url && (
                  <div className="relative aspect-video overflow-hidden rounded-lg">
                    <Image
                      alt={img.description ?? ""}
                      className="object-cover"
                      fill
                      sizes="(max-width: 768px) 100vw, 800px"
                      src={img.image_url}
                      unoptimized
                    />
                  </div>
                )}
                {img.description && (
                  <p className="text-podcast-muted mt-2 text-sm">
                    {img.description}
                  </p>
                )}
              </div>
            ))}
          </div>
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
