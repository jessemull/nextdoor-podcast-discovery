import { Suspense } from "react";

import { FeedPageContent } from "./FeedPageContent";

export default function FeedPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen px-4 py-8 sm:px-6">
          <div className="h-10 w-48 animate-pulse rounded bg-surface" />
          <div className="mt-6 h-96 animate-pulse rounded-card bg-surface" />
        </main>
      }
    >
      <FeedPageContent />
    </Suspense>
  );
}
