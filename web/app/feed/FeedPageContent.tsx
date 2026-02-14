"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";

import { PodcastPicks } from "@/components/PodcastPicks";
import { PostFeed } from "@/components/PostFeed";
import { cn } from "@/lib/utils";
import { useSearchResults } from "@/lib/hooks/useSearchResults";

interface SettingsResponse {
  data: {
    ranking_weights: Record<string, number>;
    search_defaults: {
      similarity_threshold: number;
    };
  };
}

export function FeedPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const view = searchParams.get("view") === "picks" ? "picks" : "feed";
  const qFromUrl = searchParams.get("q") ?? "";
  const thresholdFromUrl = searchParams.get("threshold");

  const [lastSearchedQuery, setLastSearchedQuery] = useState("");
  const [query, setQuery] = useState("");
  const [loadDefaultsError, setLoadDefaultsError] = useState<null | string>(null);
  const [embeddingBacklog, setEmbeddingBacklog] = useState(0);
  const [similarityThreshold, setSimilarityThreshold] = useState(0.2);
  const [useKeywordSearch, setUseKeywordSearch] = useState(false);

  useEffect(() => {
    if (view === "feed") {
      const prev = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = prev;
      };
    }
  }, [view]);

  useEffect(() => {
    if (typeof qFromUrl === "string" && qFromUrl.trim()) {
      setQuery(qFromUrl.trim());
    }
  }, [qFromUrl]);

  useEffect(() => {
    if (thresholdFromUrl != null) {
      const n = parseFloat(thresholdFromUrl);
      if (!isNaN(n) && n >= 0 && n <= 1) {
        setSimilarityThreshold(n);
      }
    }
  }, [thresholdFromUrl]);

  useEffect(() => {
    const loadDefaults = async () => {
      try {
        const [settingsRes, statsRes] = await Promise.all([
          fetch("/api/settings"),
          fetch("/api/stats"),
        ]);
        if (settingsRes.ok) {
          const data: SettingsResponse = await settingsRes.json();
          if (
            data.data.search_defaults?.similarity_threshold !== undefined &&
            typeof data.data.search_defaults.similarity_threshold === "number"
          ) {
            if (!thresholdFromUrl) {
              setSimilarityThreshold(
                data.data.search_defaults.similarity_threshold
              );
            }
          }
        } else {
          setLoadDefaultsError(
            "Failed to load search defaults. Using default threshold."
          );
        }
        if (statsRes.ok) {
          const stats = await statsRes.json();
          setEmbeddingBacklog(stats.embedding_backlog ?? 0);
        }
      } catch (err) {
        console.error("Error loading search defaults:", err);
        setLoadDefaultsError(
          err instanceof Error
            ? `Error loading search defaults: ${err.message}`
            : "Failed to load search defaults. Using default threshold."
        );
      }
    };

    void loadDefaults();
  }, [thresholdFromUrl]);

  const {
    error: searchError,
    handleMarkSaved,
    handleMarkUsed,
    loading: searchLoading,
    markingSaved,
    results,
    runSearch,
    total: searchTotal,
  } = useSearchResults({
    minScore: "",
    query,
    similarityThreshold,
    useKeywordSearch,
  });

  const updateUrl = useCallback(
    (updates: { q?: string; threshold?: number; view?: "feed" | "picks" }) => {
      const params = new URLSearchParams(searchParams.toString());
      if (updates.q !== undefined) {
        if (updates.q.trim()) {
          params.set("q", updates.q.trim());
        } else {
          params.delete("q");
        }
      }
      if (updates.threshold !== undefined) {
        params.set("threshold", updates.threshold.toFixed(1));
      }
      if (updates.view !== undefined) {
        params.set("view", updates.view);
      }
      const queryString = params.toString();
      router.replace(`/feed${queryString ? `?${queryString}` : ""}`, {
        scroll: false,
      });
    },
    [router, searchParams]
  );

  const handleQueryChange = useCallback((value: string) => {
    setQuery(value);
  }, []);

  const handleThresholdChange = useCallback(
    (value: number) => {
      setSimilarityThreshold(value);
      updateUrl({ threshold: value });
    },
    [updateUrl]
  );

  const handleSearch = useCallback(() => {
    const q = query.trim();
    setLastSearchedQuery(q);
    void runSearch(q);
    updateUrl({ q });
  }, [query, runSearch, updateUrl]);

  const handleResetAll = useCallback(() => {
    setQuery("");
    setLastSearchedQuery("");
    updateUrl({ q: "" });
    void runSearch("");
  }, [runSearch, updateUrl]);

  return (
    <main
      className={cn(
        view === "feed"
          ? "flex h-[calc(100vh-3.5rem)] flex-col overflow-hidden pt-0"
          : "min-h-screen px-4 py-8 sm:px-6"
      )}
    >
      {view === "picks" && (
        <div className="w-full">
          <Suspense
            fallback={
              <div className="h-32 animate-pulse rounded-card bg-surface" />
            }
          >
            <PodcastPicks />
          </Suspense>
        </div>
      )}

      {view === "feed" && (
        <section
          aria-label="Feed"
          className="flex min-h-0 flex-1 flex-col min-w-0"
        >
          <PostFeed
              searchSlot={{
                debouncedQuery: lastSearchedQuery,
                embeddingBacklog,
                loadDefaultsError,
                loading: searchLoading,
                markingSaved,
                onMarkSaved: handleMarkSaved,
                onMarkUsed: handleMarkUsed,
                onQueryChange: handleQueryChange,
                onResetAll: handleResetAll,
                onSearch: handleSearch,
                onSimilarityThresholdChange: handleThresholdChange,
                onUseKeywordSearchChange: setUseKeywordSearch,
                onViewDetails: (postId) => router.push(`/posts/${postId}`),
                query,
                results,
                searchError: searchError ?? null,
                searchTotal,
                similarityThreshold,
                useKeywordSearch,
              }}
            />
        </section>
      )}
    </main>
  );
}
