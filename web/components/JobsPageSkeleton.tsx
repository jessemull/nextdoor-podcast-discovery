import { Card } from "@/components/ui/Card";

/**
 * Skeleton placeholder for jobs page content while jobs load.
 * Renders below the page header/description. Mirrors Stats card and Job Queue / Finished Jobs sections.
 */
export function JobsPageSkeleton() {
  return (
    <>
      {/* Stats card */}
      <Card className="mb-8 p-6">
        <div className="text-foreground mb-2 h-8 w-24 animate-pulse rounded bg-surface-hover" />
        <div className="text-foreground mb-6 h-4 max-w-md animate-pulse rounded bg-surface-hover" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div
              key={i}
              className="flex min-h-[4.5rem] w-full min-w-0 items-center gap-3 rounded-lg border border-white/20 bg-surface-hover/50 p-3"
            >
              <div className="h-5 w-5 shrink-0 animate-pulse rounded bg-surface-hover" />
              <div className="min-w-0 flex-1 space-y-2">
                <div className="h-6 w-12 animate-pulse rounded bg-surface-hover" />
                <div className="h-4 w-20 animate-pulse rounded bg-surface-hover" />
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Job Queue section */}
      <Card className="mb-8 p-6">
        <div className="mb-4 flex items-center justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="text-foreground mb-2 h-8 w-32 animate-pulse rounded bg-surface-hover" />
            <div className="text-foreground h-4 max-w-md animate-pulse rounded bg-surface-hover" />
          </div>
        </div>
        <div className="max-h-96 space-y-3 overflow-y-auto">
          {[1, 2].map((i) => (
            <div
              key={i}
              className="rounded border border-border bg-surface-hover/50 p-4"
            >
              <div className="mb-3 flex items-start justify-between gap-2">
                <div className="h-5 w-48 animate-pulse rounded bg-surface-hover" />
                <div className="h-6 w-14 shrink-0 animate-pulse rounded bg-surface-hover" />
              </div>
              <div className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3">
                {[1, 2, 3, 4, 5].map((j) => (
                  <div key={j} className="flex flex-col gap-1.5">
                    <div className="h-3 w-16 animate-pulse rounded bg-surface-hover" />
                    <div className="h-3 w-24 animate-pulse rounded bg-surface-hover" />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Finished Jobs section */}
      <Card className="mb-8 p-6">
        <div className="mb-4 flex items-center justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="text-foreground mb-2 h-8 w-36 animate-pulse rounded bg-surface-hover" />
            <div className="text-foreground h-4 max-w-lg animate-pulse rounded bg-surface-hover" />
          </div>
        </div>
        <div className="mb-3 flex justify-end">
          <div className="h-8 w-28 animate-pulse rounded border border-border bg-surface-hover" />
        </div>
        <div className="max-h-96 space-y-3 overflow-y-auto">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="rounded border border-border bg-surface-hover/50 p-4"
            >
              <div className="mb-3 flex items-start justify-between gap-2">
                <div className="h-5 w-48 animate-pulse rounded bg-surface-hover" />
                <div className="h-6 w-16 shrink-0 animate-pulse rounded bg-surface-hover" />
              </div>
              <div className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3">
                {[1, 2, 3, 4, 5].map((j) => (
                  <div key={j} className="flex flex-col gap-1.5">
                    <div className="h-3 w-16 animate-pulse rounded bg-surface-hover" />
                    <div className="h-3 w-24 animate-pulse rounded bg-surface-hover" />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Card>
    </>
  );
}
