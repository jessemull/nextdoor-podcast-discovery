import { Card } from "@/components/ui/Card";

/**
 * Compact skeleton placeholder for initial feed load. Several fit on screen.
 */
export function PostCardSkeleton() {
  return (
    <Card className="px-4 py-3">
      <div className="mb-3 flex items-start justify-between gap-2">
        <div className="h-8 w-8 shrink-0 animate-pulse rounded-full bg-surface-hover" />
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <div className="flex flex-wrap items-center gap-x-2">
            <span className="bg-surface-hover h-3 w-20 animate-pulse rounded" />
            <span className="bg-surface-hover h-3 w-14 animate-pulse rounded" />
            <span className="bg-surface-hover h-3 w-12 animate-pulse rounded" />
          </div>
          <div className="flex flex-wrap gap-1">
            <span className="bg-surface-hover h-4 w-12 animate-pulse rounded-md" />
            <span className="bg-surface-hover h-4 w-16 animate-pulse rounded-md" />
          </div>
        </div>
      </div>
      <div className="space-y-2">
        <div className="bg-surface-hover h-3 w-full animate-pulse rounded" />
        <div className="bg-surface-hover h-3 w-4/5 animate-pulse rounded" />
      </div>
    </Card>
  );
}
