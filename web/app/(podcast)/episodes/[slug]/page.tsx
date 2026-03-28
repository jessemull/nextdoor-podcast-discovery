import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import { PodcastAudioPlayer } from "@/components/PodcastAudioPlayer";
import { PodcastEpisodeCategoryChips } from "@/components/PodcastEpisodeCategoryChips";
import { PodcastEpisodeGridCard } from "@/components/PodcastEpisodeGridCard";
import { formatDuration } from "@/lib/format-duration";
import {
  PODCAST_ENTRANCE_CLASS,
  podcastEntranceDelayMs,
} from "@/lib/podcast-entrance-animation";
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

  const categoriesRowTopClass = episode.audio_url
    ? "mt-3.5"
    : episode.description
      ? "mt-3"
      : "mt-4";
  const categoriesAnimationDelay = episode.audio_url
    ? "280ms"
    : episode.description
      ? "160ms"
      : "80ms";
  const titleAnimationDelay =
    episode.published_at || episode.duration_seconds != null ? "80ms" : "0ms";

  return (
    <div className="mx-auto max-w-6xl px-5 pb-12 pt-8 sm:px-7 sm:pt-12">
      <script
        dangerouslySetInnerHTML={{ __html: JSON.stringify(episodeJsonLd) }}
        type="application/ld+json"
      />
      <article>
        {/* Hero */}
        <header>
          {(episode.published_at || episode.duration_seconds != null) && (
            <div
              className={`mb-2.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-white ${PODCAST_ENTRANCE_CLASS}`}
              style={{ animationDelay: "0ms" }}
            >
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
          )}
          <div
            className={PODCAST_ENTRANCE_CLASS}
            style={{ animationDelay: titleAnimationDelay }}
          >
            <h1 className="text-podcast-foreground block pb-3 text-4xl font-bold">
              {episode.title}
            </h1>
          </div>
        </header>

        {episode.description ? (
          <div
            className={PODCAST_ENTRANCE_CLASS}
            style={{ animationDelay: "120ms" }}
          >
            <p className="mt-2 whitespace-pre-wrap text-base text-[#9fb7c4]">
              {episode.description}
            </p>
          </div>
        ) : null}

        {/* Audio player */}
        {episode.audio_url ? (
          <div
            className={`mt-4 ${PODCAST_ENTRANCE_CLASS}`}
            style={{ animationDelay: "240ms" }}
          >
            <PodcastAudioPlayer
              key={episode.audio_url}
              className="w-full"
              durationSeconds={episode.duration_seconds}
              src={episode.audio_url}
            />
          </div>
        ) : null}

        {episode.categories.length > 0 ? (
          <div
            className={`${categoriesRowTopClass} flex flex-wrap items-center gap-x-2 gap-y-1 ${PODCAST_ENTRANCE_CLASS}`}
            style={{ animationDelay: categoriesAnimationDelay }}
          >
            <span className="font-medium inline-block origin-center scale-y-[1.07] shrink-0 text-xs tracking-wider text-white/70 uppercase">
              Categories
            </span>
            <PodcastEpisodeCategoryChips categories={episode.categories} />
          </div>
        ) : null}

        {(galleryForDisplay.length > 0 ||
          Boolean(episode.about_episode?.trim())) ? (
          <section
            className={`mt-8 space-y-4 sm:mt-10 ${PODCAST_ENTRANCE_CLASS}`}
            style={{ animationDelay: "300ms" }}
          >
            <h2 className="font-bold text-3xl text-podcast-foreground tracking-tight sm:text-4xl">
              About the Episode
            </h2>
            {episode.about_episode?.trim()
              ? episode.about_episode
                  .split(/\n\n+/)
                  .map((block) => block.trim())
                  .filter(Boolean)
                  .map((para, idx) => (
                    <p
                      key={idx}
                      className="whitespace-pre-wrap text-base text-[#9fb7c4]"
                    >
                      {para}
                    </p>
                  ))
              : null}
          </section>
        ) : null}

        {galleryForDisplay.length > 0 ? (
          <div className="mt-8 space-y-8 sm:mt-12">
            {galleryForDisplay.map((img, galleryIndex) => (
              <div
                key={img.id}
                className={PODCAST_ENTRANCE_CLASS}
                style={{
                  animationDelay: `${podcastEntranceDelayMs(galleryIndex, { cap: 2 })}ms`,
                }}
              >
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
                  <p className="mt-4 whitespace-pre-wrap text-base text-[#9fb7c4]">
                    {img.description}
                  </p>
                )}
              </div>
            ))}
          </div>
        ) : null}

      </article>

      {/* Related episodes */}
      {similar.length > 0 && (
        <aside aria-label="Related episodes" className="mt-4 sm:mt-12 border-t border-border pt-4 sm:pt-8">
          <h2
            className={`text-foreground mb-4 text-xl font-semibold ${PODCAST_ENTRANCE_CLASS}`}
            style={{ animationDelay: "0ms" }}
          >
            Related Episodes
          </h2>
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {similar.map((ep, relatedIndex) => (
              <li
                key={ep.id}
                className={PODCAST_ENTRANCE_CLASS}
                style={{
                  animationDelay: `${podcastEntranceDelayMs(relatedIndex)}ms`,
                }}
              >
                <PodcastEpisodeGridCard episode={ep} />
              </li>
            ))}
          </ul>
        </aside>
      )}
    </div>
  );
}
