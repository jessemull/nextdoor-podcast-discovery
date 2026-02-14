"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useEffect } from "react";

/**
 * Redirects /search to /feed with the same query params (q, threshold)
 * so existing links to /search?q=... continue to work.
 */
function SearchRedirect() {
  const searchParams = useSearchParams();

  useEffect(() => {
    const q = searchParams.get("q");
    const threshold = searchParams.get("threshold");
    const params = new URLSearchParams();
    params.set("view", "feed");
    if (q?.trim()) params.set("q", q.trim());
    if (threshold != null) params.set("threshold", threshold);
    const queryString = params.toString();
    window.location.replace(`/feed${queryString ? `?${queryString}` : ""}`);
  }, [searchParams]);

  return (
    <main className="min-h-screen p-8">
      <div className="mx-auto max-w-4xl">
        <p className="text-muted-foreground">Redirecting to feed...</p>
      </div>
    </main>
  );
}

export default function SearchPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen p-8">
          <div className="mx-auto max-w-4xl">
            <p className="text-muted-foreground">Loading...</p>
          </div>
        </main>
      }
    >
      <SearchRedirect />
    </Suspense>
  );
}
