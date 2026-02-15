import { Card } from "@/components/ui/Card";

/**
 * Skeleton placeholder for settings sections while settings and weight configs load.
 * Renders below the page header/description. Mirrors weight section and defaults cards.
 */
export function SettingsPageSkeleton() {
  return (
    <>
      {/* Active Weight Configuration card */}
      <Card className="mb-8 p-6">
          <div className="mb-2 h-8 w-64 animate-pulse rounded bg-surface-hover" />
          <div className="mb-6 h-4 w-full max-w-md animate-pulse rounded bg-surface-hover" />
          <div className="border-border rounded-card border border-dashed bg-surface-hover/50 p-4">
            <div className="mb-2 flex items-center justify-between">
              <div className="h-5 w-32 animate-pulse rounded bg-surface-hover" />
              <div className="h-5 w-16 animate-pulse rounded bg-surface-hover" />
            </div>
            <div className="mb-3 h-3 w-48 animate-pulse rounded bg-surface-hover" />
            <div className="space-y-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <div
                  key={i}
                  className="flex items-center gap-3"
                >
                  <div className="h-3 w-16 shrink-0 animate-pulse rounded bg-surface-hover" />
                  <div className="h-2 flex-1 animate-pulse rounded-full bg-surface-hover" />
                  <div className="h-3 w-8 shrink-0 animate-pulse rounded bg-surface-hover" />
                </div>
              ))}
            </div>
          </div>
        </Card>

        {/* Weight Configurations list card */}
        <Card className="mb-8 p-6">
          <div className="mb-2 h-8 w-56 animate-pulse rounded bg-surface-hover" />
          <div className="mb-6 h-4 w-full max-w-sm animate-pulse rounded bg-surface-hover" />
          <div className="max-h-[48rem] space-y-3 overflow-y-auto">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="border-border flex items-center justify-between gap-4 rounded border border-dashed bg-surface-hover/50 p-4"
              >
                <div className="min-w-0 flex-1">
                  <div className="mb-1.5 h-4 w-36 animate-pulse rounded bg-surface-hover" />
                  <div className="mb-2 h-3 w-full max-w-xs animate-pulse rounded bg-surface-hover" />
                  <div className="flex flex-wrap gap-2">
                    {[1, 2, 3, 4].map((j) => (
                      <div
                        key={j}
                        className="h-6 w-14 animate-pulse rounded-md bg-surface-hover"
                      />
                    ))}
                  </div>
                </div>
                <div className="h-8 w-8 shrink-0 animate-pulse rounded-full bg-surface-hover" />
              </div>
            ))}
          </div>
        </Card>

        {/* Add Weight Configuration card */}
        <Card className="mb-8 p-6">
          <div className="mb-2 h-8 w-72 animate-pulse rounded bg-surface-hover" />
          <div className="mb-6 h-4 w-full max-w-2xl animate-pulse rounded bg-surface-hover" />
          <div className="mb-4 h-4 w-16 animate-pulse rounded bg-surface-hover" />
          <div className="mb-6 flex flex-wrap gap-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <div
                key={i}
                className="h-9 w-20 animate-pulse rounded border border-border bg-surface-hover"
              />
            ))}
          </div>
          <div className="mb-4 h-4 w-28 animate-pulse rounded bg-surface-hover" />
          <div className="space-y-4">
            {[1, 2, 3, 4, 5, 6, 7].map((i) => (
              <div
                key={i}
                className="flex items-center justify-between gap-2"
              >
                <div className="h-4 w-24 animate-pulse rounded bg-surface-hover" />
                <div className="h-2 flex-1 max-w-xs animate-pulse rounded-full bg-surface-hover" />
              </div>
            ))}
          </div>
          <div className="mt-6 flex justify-end gap-4">
            <div className="h-9 w-20 animate-pulse rounded bg-surface-hover" />
            <div className="h-9 w-16 animate-pulse rounded bg-surface-hover" />
          </div>
        </Card>

        {/* Novelty Configuration card */}
        <Card className="mb-8 p-6">
          <div className="mb-2 h-8 w-52 animate-pulse rounded bg-surface-hover" />
          <div className="mb-3 space-y-2">
            <div className="h-4 w-full animate-pulse rounded bg-surface-hover" />
            <div className="h-4 w-full max-w-2xl animate-pulse rounded bg-surface-hover" />
            <div className="h-4 w-3/4 animate-pulse rounded bg-surface-hover" />
          </div>
          <div className="mb-6 h-4 w-40 animate-pulse rounded bg-surface-hover" />
          <div className="mb-4 space-y-4">
            <div className="flex items-center justify-between">
              <div className="h-4 w-44 animate-pulse rounded bg-surface-hover" />
              <div className="h-2 w-24 animate-pulse rounded-full bg-surface-hover" />
            </div>
            <div className="flex items-center justify-between">
              <div className="h-4 w-40 animate-pulse rounded bg-surface-hover" />
              <div className="h-2 w-24 animate-pulse rounded-full bg-surface-hover" />
            </div>
          </div>
          <div className="mb-4 h-4 w-32 animate-pulse rounded bg-surface-hover" />
          <div className="mb-6 grid grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-10 w-full animate-pulse rounded border border-border bg-surface-hover"
              />
            ))}
          </div>
          <div className="flex justify-end gap-4">
            <div className="h-9 w-20 animate-pulse rounded bg-surface-hover" />
            <div className="h-9 w-16 animate-pulse rounded bg-surface-hover" />
          </div>
        </Card>

        {/* Podcast Picks Defaults card */}
        <Card className="mb-8 p-6">
          <div className="mb-2 h-8 w-48 animate-pulse rounded bg-surface-hover" />
          <div className="mb-6 h-4 w-full max-w-xl animate-pulse rounded bg-surface-hover" />
          <div className="mb-4 h-4 w-28 animate-pulse rounded bg-surface-hover" />
          <div className="mb-6 grid grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="space-y-2"
              >
                <div className="h-4 w-24 animate-pulse rounded bg-surface-hover" />
                <div className="h-10 w-full animate-pulse rounded border border-border bg-surface-hover" />
              </div>
            ))}
          </div>
          <div className="flex justify-end gap-4">
            <div className="h-9 w-20 animate-pulse rounded bg-surface-hover" />
            <div className="h-9 w-16 animate-pulse rounded bg-surface-hover" />
          </div>
        </Card>

        {/* Search Defaults card */}
        <Card className="mb-8 p-6">
          <div className="mb-2 h-8 w-40 animate-pulse rounded bg-surface-hover" />
          <div className="mb-6 h-4 w-full max-w-lg animate-pulse rounded bg-surface-hover" />
          <div className="mb-4 h-4 w-28 animate-pulse rounded bg-surface-hover" />
          <div className="mb-2 flex items-center justify-between">
            <div className="h-4 w-36 animate-pulse rounded bg-surface-hover" />
            <div className="h-4 w-12 animate-pulse rounded bg-surface-hover" />
          </div>
          <div className="mb-4 h-2 w-full animate-pulse rounded-full bg-surface-hover" />
          <div className="flex justify-end gap-4">
            <div className="h-9 w-20 animate-pulse rounded bg-surface-hover" />
            <div className="h-9 w-16 animate-pulse rounded bg-surface-hover" />
          </div>
        </Card>
    </>
  );
}
