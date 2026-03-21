import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import { PodcastAudioPlayer } from "@/components/PodcastAudioPlayer";
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
      images: episode.image_url ? [episode.image_url] : undefined,
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
    <div className="mx-auto max-w-6xl px-5 py-12 sm:px-7">
      <script
        dangerouslySetInnerHTML={{ __html: JSON.stringify(episodeJsonLd) }}
        type="application/ld+json"
      />
      <article>
        {/* Hero */}
        <header className="mb-8">
          {episode.image_url && (
            <div className="relative mb-4 aspect-video overflow-hidden rounded-lg">
              <Image
                alt=""
                className="object-cover"
                fill
                sizes="(max-width: 768px) 100vw, 800px"
                src={episode.image_url}
                unoptimized
              />
            </div>
          )}
          <h1 className="text-foreground mb-2 text-2xl font-bold tracking-tight sm:text-3xl">
            {episode.title}
          </h1>
          <div className="text-muted flex flex-wrap gap-3 text-sm">
            {episode.published_at && (
              <time dateTime={episode.published_at}>
                {new Date(episode.published_at).toLocaleDateString()}
              </time>
            )}
            {episode.duration_seconds != null && (
              <span>{Math.floor(episode.duration_seconds / 60)} min</span>
            )}
          </div>
        </header>

        {/* Audio player */}
        {episode.audio_url && (
          <div className="mb-8">
            <PodcastAudioPlayer
              key={episode.audio_url}
              className="w-full"
              durationSeconds={episode.duration_seconds}
              src={episode.audio_url}
            />
          </div>
        )}

        {/* Description */}
        {episode.description && (
          <div className="text-foreground mb-8 whitespace-pre-wrap text-base">
            {episode.description}
          </div>
        )}

        {/* Show notes */}
        {episode.show_notes && (
          <div className="mb-8">
            <h2 className="text-foreground mb-2 text-lg font-semibold">
              Show Notes
            </h2>
            <div className="text-foreground whitespace-pre-wrap text-base">
              {episode.show_notes}
            </div>
          </div>
        )}
      </article>

      {/* Related episodes */}
      {similar.length > 0 && (
        <aside aria-label="Related episodes" className="mt-12 border-t border-border pt-8">
          <h2 className="text-foreground mb-4 text-xl font-semibold">
            Related Episodes
          </h2>
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {similar.map((ep) => (
              <li key={ep.id}>
                <Link
                  className="border-border bg-surface-hover/30 flex gap-3 rounded-lg border p-3 transition-colors hover:border-border-focus"
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
                    <h3 className="text-foreground line-clamp-2 text-sm font-medium">
                      {ep.title}
                    </h3>
                    {ep.published_at && (
                      <time
                        className="text-muted text-xs"
                        dateTime={ep.published_at}
                      >
                        {new Date(ep.published_at).toLocaleDateString()}
                      </time>
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
