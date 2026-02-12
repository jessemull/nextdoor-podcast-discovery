/**
 * Server-side error logging for API routes and server code.
 * Use instead of ad-hoc console.error for consistent, filterable logs.
 */

import "server-only";

/**
 * Log an error with context. Use in API route catch blocks and server code.
 *
 * @param context - Short label (e.g. "[posts]", "[search]")
 * @param error - Caught error (unknown)
 */
export function logError(context: string, error: unknown): void {
  const message = error instanceof Error ? error.message : String(error);
  const stack = error instanceof Error ? error.stack : undefined;
  const name = error instanceof Error ? error.constructor.name : typeof error;

  console.error(`${context}`, {
    error: message,
    name,
    stack,
  });
}
