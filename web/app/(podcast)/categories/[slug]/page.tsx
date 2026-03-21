import Image from "next/image";
import Link from "next/link";

import { getEpisodesByCategorySafe } from "@/lib/podcast.server";

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
  const episodes = await getEpisodesByCategorySafe(slug, 50, 0);
  const categoryName = slug.replace(/-/g, " ");

  return (
    <div className="mx-auto max-w-6xl px-5 py-12 sm:px-7">
      <nav aria-label="Breadcrumb" className="text-muted mb-4 text-sm">
        <Link className="hover:text-foreground" href="/categories">
          Categories
        </Link>
        <span className="mx-2">/</span>
        <span className="text-foreground capitalize">{categoryName}</span>
      </nav>
      <h1 className="text-foreground mb-6 text-2xl font-bold capitalize">
        {categoryName}
      </h1>
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
      ) : (
        <p className="text-muted">No episodes in this category yet.</p>
      )}
    </div>
  );
}
