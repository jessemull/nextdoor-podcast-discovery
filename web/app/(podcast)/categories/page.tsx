import Link from "next/link";

import { getPodcastCategoriesSafe } from "@/lib/podcast.server";

import type { Metadata } from "next";

export const metadata: Metadata = {
  description: "Browse podcast episodes by category.",
  title: "Categories | Podcast",
};

export const revalidate = 60;

export default async function CategoriesPage() {
  const categories = await getPodcastCategoriesSafe();

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      <h1 className="text-foreground mb-6 text-2xl font-bold">Categories</h1>
      {categories.length > 0 ? (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {categories.map((cat) => (
            <li key={cat.id}>
              <Link
                className="border-border bg-surface-hover/50 block rounded-lg border p-4 transition-colors hover:border-border-focus"
                href={`/categories/${cat.slug}`}
              >
                <h2 className="text-foreground font-semibold">{cat.name}</h2>
                {cat.description && (
                  <p className="text-muted mt-1 text-sm">{cat.description}</p>
                )}
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-muted">No categories yet. Check back soon.</p>
      )}
    </div>
  );
}
