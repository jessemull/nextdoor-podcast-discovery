import { PostCardSkeleton } from "@/components/PostCardSkeleton";

/**
 * Loading UI for post detail route segment.
 */
export default function PostDetailLoading() {
  return (
    <main className="min-h-screen px-6 py-6 sm:px-8 sm:py-8">
      <div className="mx-auto max-w-3xl">
        <div className="mb-6 h-8 w-32 animate-pulse rounded bg-surface" />
        <PostCardSkeleton />
      </div>
    </main>
  );
}
