import { Suspense } from "react";

import { FeedPageContent } from "./FeedPageContent";

export default function FeedPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen p-8">
          <div className="mx-auto max-w-5xl">
            <div className="mb-6 h-10 w-48 animate-pulse rounded bg-surface" />
            <div className="h-96 animate-pulse rounded-card bg-surface" />
          </div>
        </main>
      }
    >
      <FeedPageContent />
    </Suspense>
  );
}
