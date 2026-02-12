import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Merge Tailwind classes with proper conflict resolution.
 * Example: cn("px-2", "px-4") => "px-4" (not "px-2 px-4")
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/**
 * Format a date for relative display (e.g., "2 days ago").
 * Handles both past and future dates.
 */
export function formatRelativeTime(date: null | string): string {
  if (!date) return "Unknown";

  const now = new Date();
  const then = new Date(date);
  const diffMs = now.getTime() - then.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  // Handle future dates

  if (diffDays < 0) {
    const futureDays = Math.abs(diffDays);
    if (futureDays === 1) return "Tomorrow";
    if (futureDays < 7) return `In ${futureDays} days`;
    if (futureDays < 30) return `In ${Math.floor(futureDays / 7)} weeks`;
    return `In ${Math.floor(futureDays / 30)} months`;
  }

  // Handle past dates

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
  return `${Math.floor(diffDays / 365)} years ago`;
}

/**
 * Truncate text to a maximum length with ellipsis.
 */
export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + "...";
}

/**
 * Calculate success rate as a percentage (0-100) rounded to 2 decimal places.
 *
 * @param completed - Number of completed items
 * @param errors - Number of error items
 * @returns Success rate percentage (0-100) rounded to 2 decimal places, or 0 if no finished items
 *
 * @example
 * calculateSuccessRate(8, 2) // Returns 80.00 (80% success rate)
 * calculateSuccessRate(0, 0) // Returns 0 (no finished items)
 */
export function calculateSuccessRate(completed: number, errors: number): number {
  const totalFinished = completed + errors;
  if (totalFinished === 0) {
    return 0;
  }
  const successRatePercent = (completed / totalFinished) * 100;
  return Number(successRatePercent.toFixed(2));
}

/**
 * Format a category key (snake_case) for display (e.g. "Local News").
 */
export function formatCategoryLabel(categoryKey: string): string {
  if (!categoryKey) return categoryKey;
  return categoryKey
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

// UI Constants

export const POST_PREVIEW_LENGTH = 300;
export const POSTS_PER_PAGE = 20;
