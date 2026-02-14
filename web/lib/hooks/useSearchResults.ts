"use client";

import { useCallback, useEffect, useState } from "react";

import type { PostWithScores } from "@/lib/types";

interface SearchResponse {
  data: PostWithScores[];
  total: number;
}

export interface UseSearchResultsParams {
  minScore: "" | number;
  query: string;
  similarityThreshold: number;
  useKeywordSearch: boolean;
}

export interface UseSearchResultsResult {
  error: null | string;
  handleMarkSaved: (postId: string, saved: boolean) => Promise<void>;
  handleMarkUsed: (postId: string) => Promise<void>;
  loading: boolean;
  markingSaved: Set<string>;
  results: PostWithScores[];
  runSearch: (searchQuery: string) => Promise<void>;
  total: number;
}

export function useSearchResults(
  params: UseSearchResultsParams
): UseSearchResultsResult {
  const {
    minScore,
    query,
    similarityThreshold,
    useKeywordSearch,
  } = params;

  const [error, setError] = useState<null | string>(null);
  const [loading, setLoading] = useState(false);
  const [markingSaved, setMarkingSaved] = useState<Set<string>>(new Set());
  const [results, setResults] = useState<PostWithScores[]>([]);
  const [total, setTotal] = useState(0);

  const runSearch = useCallback(
    async (searchQuery: string) => {
      if (!searchQuery.trim()) {
        setResults([]);
        setTotal(0);
        setError(null);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const response = useKeywordSearch
          ? await fetch(
              `/api/search?q=${encodeURIComponent(searchQuery.trim())}&limit=20`
            )
          : await fetch("/api/search", {
              body: JSON.stringify({
                limit: 20,
                min_score:
                  typeof minScore === "number" ? minScore : undefined,
                query: searchQuery.trim(),
                similarity_threshold: similarityThreshold,
              }),
              headers: {
                "Content-Type": "application/json",
              },
              method: "POST",
            });

        if (!response.ok) {
          let errorMessage = "Search failed";
          try {
            const errorData = await response.json();
            errorMessage =
              errorData.error || errorData.details || errorMessage;
          } catch {
            errorMessage = `HTTP ${response.status}: ${response.statusText}`;
          }
          throw new Error(errorMessage);
        }

        const data: SearchResponse = await response.json();
        setResults(data.data || []);
        setTotal(data.total || 0);
      } catch (err) {
        console.error("Search error:", err);
        setError(
          err instanceof Error ? err.message : "Failed to search posts"
        );
        setResults([]);
        setTotal(0);
      } finally {
        setLoading(false);
      }
    },
    [minScore, similarityThreshold, useKeywordSearch]
  );

  const handleMarkSaved = useCallback(
    async (postId: string, saved: boolean) => {
      if (markingSaved.has(postId)) return;
      setMarkingSaved((prev) => new Set(prev).add(postId));
      try {
        const response = await fetch(`/api/posts/${postId}/saved`, {
          body: JSON.stringify({ saved }),
          headers: { "Content-Type": "application/json" },
          method: "PATCH",
        });
        if (response.ok) {
          setResults((prev) =>
            prev.map((post) =>
              post.id === postId ? { ...post, saved } : post
            )
          );
        }
      } finally {
        setMarkingSaved((prev) => {
          const next = new Set(prev);
          next.delete(postId);
          return next;
        });
      }
    },
    [markingSaved]
  );

  const handleMarkUsed = useCallback(async (postId: string) => {
    try {
      const response = await fetch(`/api/posts/${postId}/used`, {
        body: JSON.stringify({ used: true }),
        headers: { "Content-Type": "application/json" },
        method: "PATCH",
      });

      if (!response.ok) {
        throw new Error("Failed to mark post as used");
      }

      setResults((prev) =>
        prev.map((post) =>
          post.id === postId ? { ...post, used_on_episode: true } : post
        )
      );
    } catch (err) {
      console.error("Error marking post as used:", err);
    }
  }, []);

  return {
    error,
    handleMarkSaved,
    handleMarkUsed,
    loading,
    markingSaved,
    results,
    runSearch,
    total,
  };
}
