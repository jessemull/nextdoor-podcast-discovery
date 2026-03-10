import { Suspense } from "react";

import { FeedPageContent } from "@/app/(protected)/feed/FeedPageContent";

export default function ClassifiedsPage() {
  return (
    <Suspense
      fallback={
        <main className="h-full overflow-auto px-6 py-6 sm:px-8 sm:py-8">
          <div className="h-10 w-48 animate-pulse rounded bg-surface" />
          <div className="mt-6 h-96 animate-pulse rounded-card bg-surface" />
        </main>
      }
    >
      <FeedPageContent postType="classified" />
    </Suspense>
  );
}
