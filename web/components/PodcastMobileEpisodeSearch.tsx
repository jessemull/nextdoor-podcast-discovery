"use client";

import { Search, X } from "lucide-react";
import { useRef } from "react";

import { usePodcastSearch } from "@/components/PodcastSearchProvider";
import { playfair } from "@/lib/fonts";

export function PodcastMobileEpisodeSearch() {
  const { handleClear, handleSearchChange, inputValue } = usePodcastSearch();
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="mb-8 md:hidden">
      <h2
        className={`font-semibold leading-tight mb-7 text-3xl text-white ${playfair.className}`}
      >
        Episodes
      </h2>
      <div className="relative">
        <Search
          aria-hidden
          className="text-podcast-muted pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2"
        />
        <input
          aria-label="Search for episodes"
          className="bg-surface text-podcast-foreground placeholder:text-podcast-muted w-full min-w-0 rounded-lg border-2 border-podcast-accent py-2.5 pl-8 pr-10 text-base focus:outline-none"
          data-podcast-search-input
          placeholder="Search for episodes..."
          ref={inputRef}
          type="search"
          value={inputValue}
          onChange={handleSearchChange}
        />
        {inputValue ? (
          <button
            aria-label="Clear search"
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-white transition-opacity hover:opacity-80 focus:outline-none focus:ring-2 focus:ring-podcast-accent focus:ring-offset-2 focus:ring-offset-surface"
            type="button"
            onClick={() => {
              handleClear();
              inputRef.current?.focus();
            }}
          >
            <X aria-hidden className="h-3.5 w-3.5" />
          </button>
        ) : null}
      </div>
    </div>
  );
}
