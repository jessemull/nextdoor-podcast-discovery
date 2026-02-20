import { Suspense } from "react";

import { FeedPageContent } from "./FeedPageContent";

export default function FeedPage() {
  return (
    <Suspense
      fallback={
        <main className="h-full overflow-auto px-6 py-6 sm:px-8 sm:py-8">
          <div className="h-10 w-48 animate-pulse rounded bg-surface" />
          <div className="mt-6 h-96 animate-pulse rounded-card bg-surface" />
        </main>
      }
    >
      <FeedPageContent />
    </Suspense>
  );
}
