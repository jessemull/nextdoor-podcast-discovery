"use client";

import { Search } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";

import { ActiveConfigBadge } from "@/components/ActiveConfigBadge";
import { FeedSearchBar } from "@/components/FeedSearchBar";
import { PodcastPicks } from "@/components/PodcastPicks";
import { PostCard } from "@/components/PostCard";
import { PostFeed } from "@/components/PostFeed";
import { Card } from "@/components/ui/Card";
import { DEBOUNCE_DELAY_MS } from "@/lib/constants";
import { useDebounce } from "@/lib/hooks";
import { useSearchResults } from "@/lib/hooks/useSearchResults";
import { cn } from "@/lib/utils";

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

  const [query, setQuery] = useState("");
  const [loadDefaultsError, setLoadDefaultsError] = useState<null | string>(null);
  const [embeddingBacklog, setEmbeddingBacklog] = useState(0);
  const [similarityThreshold, setSimilarityThreshold] = useState(0.2);
  const [minScore, setMinScore] = useState<"" | number>("");
  const [useKeywordSearch, setUseKeywordSearch] = useState(false);

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

  const debouncedQuery = useDebounce(query, DEBOUNCE_DELAY_MS);

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
    minScore,
    query: debouncedQuery,
    similarityThreshold,
    useKeywordSearch,
  });

  useEffect(() => {
    void runSearch(debouncedQuery);
  }, [debouncedQuery, runSearch]);

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

  const handleQueryChange = useCallback(
    (value: string) => {
      setQuery(value);
      updateUrl({ q: value });
    },
    [updateUrl]
  );

  const handleThresholdChange = useCallback(
    (value: number) => {
      setSimilarityThreshold(value);
      updateUrl({ threshold: value });
    },
    [updateUrl]
  );

  const handleSearch = useCallback(() => {
    void runSearch(query.trim());
  }, [query, runSearch]);

  const tabBase =
    "border-b-2 px-4 py-2 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-border-focus";
  const tabInactive =
    "border-transparent text-muted hover:border-border hover:text-foreground";
  const tabActive = "border-border-focus text-foreground";

  return (
    <main className="min-h-screen p-8">
      <div className="mx-auto max-w-5xl">
        <div className="mb-6 flex items-center gap-4">
          <nav aria-label="Feed view" className="flex gap-0">
            <Link
              aria-current={view === "feed" ? "page" : undefined}
              className={cn(
                tabBase,
                view === "feed" ? tabActive : tabInactive
              )}
              href="/feed"
            >
              Feed
            </Link>
            <Link
              aria-current={view === "picks" ? "page" : undefined}
              className={cn(
                tabBase,
                view === "picks" ? tabActive : tabInactive
              )}
              href="/feed?view=picks"
            >
              Picks
            </Link>
          </nav>
          {view === "feed" && <ActiveConfigBadge />}
        </div>

        {view === "picks" && (
          <Suspense
            fallback={
              <div className="h-32 animate-pulse rounded-card bg-surface" />
            }
          >
            <PodcastPicks />
          </Suspense>
        )}

        {view === "feed" && (
          <section aria-label="Feed">
            <FeedSearchBar
              embeddingBacklog={embeddingBacklog}
              loadDefaultsError={loadDefaultsError}
              loading={searchLoading}
              minScore={minScore}
              onMinScoreChange={setMinScore}
              onQueryChange={handleQueryChange}
              onSearch={handleSearch}
              onSimilarityThresholdChange={handleThresholdChange}
              onUseKeywordSearchChange={setUseKeywordSearch}
              query={query}
              similarityThreshold={similarityThreshold}
              useKeywordSearch={useKeywordSearch}
            />

            {query.trim() ? (
              <div className="space-y-6">
                {searchError && (
                  <Card className="border-destructive bg-destructive/10 text-destructive text-sm">
                    {searchError}
                  </Card>
                )}

                {!searchLoading && debouncedQuery === query && query.trim() && searchTotal > 0 && (
                  <p className="text-muted-foreground text-sm">
                    Found {searchTotal}{" "}
                    {searchTotal === 1 ? "post" : "posts"}
                  </p>
                )}

                {!searchLoading &&
                  query.trim() &&
                  debouncedQuery === query &&
                  searchTotal === 0 &&
                  !searchError && (
                    <Card className="py-8 text-center">
                      <Search
                        aria-hidden
                        className="text-muted mx-auto mb-2 h-10 w-10"
                      />
                      <p className="text-foreground mb-1 font-medium">
                        No posts found
                      </p>
                      <p className="text-muted-foreground text-sm">
                        Try different search terms or lower the similarity
                        threshold.
                      </p>
                    </Card>
                  )}

                {results.length > 0 && (
                  <div className="space-y-4">
                    {results.map((post) => (
                      <PostCard
                        key={post.id}
                        isMarkingSaved={markingSaved.has(post.id)}
                        post={post}
                        onMarkSaved={handleMarkSaved}
                        onMarkUsed={handleMarkUsed}
                        onViewDetails={() =>
                          router.push(`/posts/${post.id}`)
                        }
                      />
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <PostFeed />
            )}
          </section>
        )}
      </div>
    </main>
  );
}
