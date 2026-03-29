"use client";

import Link from "next/link";

import { cn } from "@/lib/utils";

import type { PodcastEpisodeCategoryRef } from "@/lib/podcast.types";

interface PodcastEpisodeCategoryChipsProps {
  categories: PodcastEpisodeCategoryRef[];
  className?: string;
}

/**
 * Topic links for an episode (homepage feed, episode detail). Empty when no categories.
 * Uses hex + opacity (not `podcast-accent/80`) so muted yellow works with CSS-variable theme colors.
 */
export function PodcastEpisodeCategoryChips({
  categories,
  className,
}: PodcastEpisodeCategoryChipsProps) {
  if (categories.length === 0) {
    return null;
  }

  return (
    <div className={cn("flex flex-wrap gap-1", className)}>
      {categories.map((cat) => (
        <Link
          key={cat.slug}
          className="rounded border border-[#eecf3e]/75 bg-transparent px-1 py-px text-[0.625rem] font-medium leading-snug text-[#eecf3e]/85 transition-colors hover:border-[#eecf3e] hover:bg-[#eecf3e]/20 hover:text-[#eecf3e] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#eecf3e]/40 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)]"
          href={`/categories/${cat.slug}`}
        >
          {cat.name}
        </Link>
      ))}
    </div>
  );
}
