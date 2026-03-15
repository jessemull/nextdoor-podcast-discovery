/**
 * Format duration in seconds to HH:MM:SS or MM:SS for display.
 */
export function formatDuration(seconds: number | null): string {
  if (seconds == null) return "";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const parts: number[] = h > 0 ? [h, m, s] : [m, s];
  return parts.map((n) => n.toString().padStart(2, "0")).join(":");
}
