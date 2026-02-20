"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { PostFeed } from "@/components/PostFeed";
import { useSearchResults } from "@/lib/hooks/useSearchResults";

interface PicksDefaults {
  picks_limit: number;
  picks_min: number;
  picks_min_podcast?: number;
}

interface SettingsResponse {
  data: {
    picks_defaults?: PicksDefaults;
    ranking_weights: Record<string, number>;
    search_defaults: {
      similarity_threshold: number;
    };
  };
}

export function FeedPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const qFromUrl = searchParams.get("q") ?? "";
  const thresholdFromUrl = searchParams.get("threshold");

  const [embeddingBacklog, setEmbeddingBacklog] = useState(0);
  const [lastSearchedQuery, setLastSearchedQuery] = useState("");
  const [loadDefaultsError, setLoadDefaultsError] = useState<null | string>(null);
  const [picksDefaults, setPicksDefaults] = useState<null | PicksDefaults>(null);
  const [query, setQuery] = useState("");
  const [similarityThreshold, setSimilarityThreshold] = useState(0.2);
  const [useKeywordSearch, setUseKeywordSearch] = useState(false);

  useEffect(() => {
    if (typeof qFromUrl === "string" && qFromUrl.trim()) {
      setQuery(qFromUrl.trim());
      setLastSearchedQuery(qFromUrl.trim());
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
          if (
            data.data.picks_defaults &&
            typeof data.data.picks_defaults.picks_min === "number" &&
            typeof data.data.picks_defaults.picks_limit === "number"
          ) {
            setPicksDefaults({
              picks_limit: data.data.picks_defaults.picks_limit,
              picks_min: data.data.picks_defaults.picks_min,
              picks_min_podcast: data.data.picks_defaults.picks_min_podcast,
            });
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

  useEffect(() => {
    if (typeof qFromUrl === "string" && qFromUrl.trim()) {
      void runSearch(qFromUrl.trim());
    }
  }, [qFromUrl, runSearch]);

  const updateUrl = useCallback(
    (updates: { q?: string; threshold?: number }) => {
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

  const handleSearch = useCallback(
    (queryOverride?: string) => {
      const q =
        queryOverride !== undefined ? queryOverride.trim() : query.trim();
      if (queryOverride !== undefined) {
        setQuery(q);
        setLastSearchedQuery(q);
      } else {
        setLastSearchedQuery(q);
      }
      void runSearch(q);
      updateUrl({ q });
    },
    [query, runSearch, updateUrl]
  );

  const handleResetAll = useCallback(() => {
    setQuery("");
    setLastSearchedQuery("");
    updateUrl({ q: "" });
    void runSearch("");
  }, [runSearch, updateUrl]);

  return (
    <main className="flex h-full flex-col overflow-hidden pt-0">
      <section
        aria-label="Feed"
        className="flex min-h-0 flex-1 flex-col min-w-0"
      >
        <PostFeed
          picksDefaults={picksDefaults}
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
    </main>
  );
}
