"use client";

import { useEffect, useState } from "react";

import type { TopicFrequency } from "@/lib/types";

interface NoveltyConfig {
  frequency_thresholds?: { common: number; rare: number; very_common: number };
  max_multiplier?: number;
  min_multiplier?: number;
}

/**
 * Computes novelty multiplier from category count (matches scraper novelty.py logic).
 */
function getMultiplier(
  count: number,
  config: NoveltyConfig
): { mult: number; status: "boosted" | "neutral" | "penalized" } {
  const rare = config.frequency_thresholds?.rare ?? 5;
  const common = config.frequency_thresholds?.common ?? 30;
  const veryCommon = config.frequency_thresholds?.very_common ?? 100;
  const maxMult = config.max_multiplier ?? 1.5;
  const minMult = config.min_multiplier ?? 0.2;

  if (count <= rare) {
    return { mult: maxMult, status: "boosted" };
  }
  if (count <= common) {
    const ratio = (count - rare) / (common - rare);
    const mult = maxMult - ratio * (maxMult - 1.0);
    return { mult, status: "neutral" };
  }
  if (count <= veryCommon) {
    const ratio = (count - common) / (veryCommon - common);
    const mult = 1.0 - ratio * (1.0 - minMult);
    return { mult, status: "neutral" };
  }
  return { mult: minMult, status: "penalized" };
}

interface NoveltyPreviewProps {
  noveltyConfig: NoveltyConfig;
}

/**
 * NoveltyPreview shows which topic categories are currently boosted or penalized
 * based on their 30-day frequency and the novelty config.
 */
export function NoveltyPreview({ noveltyConfig }: NoveltyPreviewProps) {
  const [topCategories, setTopCategories] = useState<TopicFrequency[]>([]);
  const [loadError, setLoadError] = useState<null | string>(null);

  useEffect(() => {
    fetch("/api/stats")
      .then((res) => (res.ok ? res.json() : { top_categories: [] }))
      .then((data) => setTopCategories(data.top_categories || []))
      .catch(() => setLoadError("Could not load topic frequencies"));
  }, []);

  if (loadError) return null;
  if (topCategories.length === 0) return null;

  return (
    <div className="border-border bg-surface-hover/30 mt-4 rounded border p-4">
      <h4 className="text-muted-foreground mb-2 text-xs font-semibold">
        Novelty preview (30-day window)
      </h4>
      <p className="text-muted-foreground mb-3 text-xs">
        Topics with low frequency get a score boost; overused topics get
        penalized.
      </p>
      <div className="flex flex-wrap gap-2">
        {topCategories.map((cat) => {
          const { mult } = getMultiplier(cat.count_30d, noveltyConfig);
          return (
            <span
              key={cat.category}
              className="rounded border border-border bg-surface-hover px-2 py-1 text-muted text-xs"
              title={`${cat.category}: ${cat.count_30d} posts → ${mult.toFixed(2)}×`}
            >
              {cat.category}: {cat.count_30d} ({mult.toFixed(2)}×)
            </span>
          );
        })}
      </div>
    </div>
  );
}
