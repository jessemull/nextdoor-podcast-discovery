/**
 * Status pill for podcast episodes — matches admin job status badges (border + tint).
 */
export function EpisodeStatusBadge({ status }: { status: string }) {
  const s = status.toLowerCase();
  const published =
    s === "published"
      ? true
      : s === "draft"
        ? false
        : null;
  const className =
    published === true
      ? "inline-flex shrink-0 items-center rounded border border-purple-500/60 bg-purple-500/15 px-2 py-0.5 text-xs font-medium text-purple-300"
      : published === false
        ? "inline-flex shrink-0 items-center rounded border border-amber-500/60 bg-amber-500/15 px-2 py-0.5 text-xs font-medium text-amber-400"
        : "inline-flex shrink-0 items-center rounded border border-border bg-surface px-2 py-0.5 text-xs font-medium text-muted-foreground";
  const label =
    published === true
      ? "Published"
      : published === false
        ? "Draft"
        : status;

  return <span className={className}>{label}</span>;
}
