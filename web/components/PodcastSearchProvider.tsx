"use client";

import { createContext, useContext, type ReactNode } from "react";

import { usePodcastSearchUrl } from "@/lib/hooks/usePodcastSearchUrl";

type PodcastSearchContextValue = ReturnType<typeof usePodcastSearchUrl>;

const PodcastSearchContext = createContext<PodcastSearchContextValue | null>(
  null
);

export function PodcastSearchProvider({ children }: { children: ReactNode }) {
  const value = usePodcastSearchUrl();

  return (
    <PodcastSearchContext.Provider value={value}>
      {children}
    </PodcastSearchContext.Provider>
  );
}

export function usePodcastSearch() {
  const ctx = useContext(PodcastSearchContext);
  if (!ctx) {
    throw new Error("usePodcastSearch must be used within PodcastSearchProvider");
  }
  return ctx;
}
