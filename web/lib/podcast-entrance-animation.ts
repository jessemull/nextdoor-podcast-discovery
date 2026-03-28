/**
 * Shared entrance animation for public podcast pages (fade-in-up from tailwind.config.ts).
 * Pair with style={{ animationDelay: `${podcastEntranceDelayMs(i)}ms` }} for staggered lists.
 */
export const PODCAST_ENTRANCE_CLASS =
  "animate-fade-in-up-slow opacity-0 motion-reduce:animate-none motion-reduce:opacity-100";

const DEFAULT_CAP = 8;
const DEFAULT_STEP_MS = 60;

export function podcastEntranceDelayMs(
  index: number,
  options?: { cap?: number; stepMs?: number }
): number {
  const cap = options?.cap ?? DEFAULT_CAP;
  const stepMs = options?.stepMs ?? DEFAULT_STEP_MS;
  return Math.min(index, cap) * stepMs;
}
