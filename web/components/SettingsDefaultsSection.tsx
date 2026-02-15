"use client";

import { NoveltyConfigEditor } from "./NoveltyConfigEditor";
import { PicksDefaultsEditor } from "./PicksDefaultsEditor";
import { SearchDefaultsEditor } from "./SearchDefaultsEditor";

interface NoveltyConfig {
  frequency_thresholds?: { common: number; rare: number; very_common: number };
  max_multiplier?: number;
  min_multiplier?: number;
  window_days?: number;
}

interface SettingsDefaultsSectionProps {
  noveltyConfig: NoveltyConfig;
  onSaveNovelty: () => Promise<void>;
  onSavePicks: () => Promise<void>;
  onSaveSearch: () => Promise<void>;
  picksDefaults: { picks_limit: number; picks_min: number; picks_min_podcast?: number };
  searchDefaults: { similarity_threshold: number };
  setNoveltyConfig: (config: NoveltyConfig) => void;
  setPicksDefaults: (defaults: {
    picks_limit: number;
    picks_min: number;
    picks_min_podcast?: number;
  }) => void;
  setSearchDefaults: (defaults: { similarity_threshold: number }) => void;
}

export function SettingsDefaultsSection({
  noveltyConfig,
  onSaveNovelty,
  onSavePicks,
  onSaveSearch,
  picksDefaults,
  searchDefaults,
  setNoveltyConfig,
  setPicksDefaults,
  setSearchDefaults,
}: SettingsDefaultsSectionProps) {
  return (
    <>
      <NoveltyConfigEditor
        noveltyConfig={noveltyConfig}
        setNoveltyConfig={setNoveltyConfig}
        onSave={onSaveNovelty}
      />
      <PicksDefaultsEditor
        picksDefaults={picksDefaults}
        setPicksDefaults={setPicksDefaults}
        onSave={onSavePicks}
      />
      <SearchDefaultsEditor
        searchDefaults={searchDefaults}
        setSearchDefaults={setSearchDefaults}
        onSave={onSaveSearch}
      />
    </>
  );
}
