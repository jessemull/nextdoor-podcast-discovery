import Link from "next/link";

import { PodcastEpisodeGridCard } from "@/components/PodcastEpisodeGridCard";
import {
  PODCAST_ENTRANCE_CLASS,
  podcastEntranceDelayMs,
} from "@/lib/podcast-entrance-animation";
import {
  getEpisodesByCategorySafe,
  getPodcastCategoriesSafe,
} from "@/lib/podcast.server";

import type { Metadata } from "next";

interface CategoryPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({
  params,
}: CategoryPageProps): Promise<Metadata> {
  const { slug } = await params;
  const title = slug.replace(/-/g, " ");
  return {
    description: `Episodes in ${title}.`,
    title: `${title} | Categories | Podcast`,
  };
}

export const revalidate = 60;

export default async function CategoryPage({ params }: CategoryPageProps) {
  const { slug } = await params;
  const [episodes, categories] = await Promise.all([
    getEpisodesByCategorySafe(slug, 50, 0),
    getPodcastCategoriesSafe(),
  ]);
  const match = categories.find((c) => c.slug === slug);
  const categoryName = match?.name ?? slug.replace(/-/g, " ");

  return (
    <div className="mx-auto max-w-6xl px-5 py-12 sm:px-7">
      <nav
        aria-label="Breadcrumb"
        className={`text-muted mb-4 text-sm ${PODCAST_ENTRANCE_CLASS}`}
        style={{ animationDelay: "0ms" }}
      >
        <Link className="hover:text-foreground" href="/">
          Home
        </Link>
        <span className="mx-2">/</span>
        <span className="text-foreground">{categoryName}</span>
      </nav>
      <div
        className={PODCAST_ENTRANCE_CLASS}
        style={{ animationDelay: "80ms" }}
      >
        <h1 className="text-foreground mb-6 text-2xl font-bold">
          {categoryName}
        </h1>
      </div>
      {episodes.length > 0 ? (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {episodes.map((ep, index) => (
            <li
              key={ep.id}
              className={PODCAST_ENTRANCE_CLASS}
              style={{
                animationDelay: `${podcastEntranceDelayMs(index)}ms`,
              }}
            >
              <PodcastEpisodeGridCard episode={ep} />
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-muted">No episodes in this category yet.</p>
      )}
    </div>
  );
}
