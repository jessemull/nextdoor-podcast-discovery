/**
 * Helpers for Supabase auth errors (e.g. invalid/missing refresh token).
 * Use to treat these as "no session" instead of surfacing as uncaught errors.
 */

/**
 * True if the error is Supabase "Invalid Refresh Token" / "Refresh Token Not Found".
 * When this happens, treat the user as signed out and clear or ignore the bad session.
 */
export function isInvalidRefreshTokenError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const msg = String((error as { message?: string }).message ?? "");
  const code = String((error as { code?: string }).code ?? "");
  return (
    msg.includes("Refresh Token") ||
    msg.includes("refresh_token") ||
    code.includes("refresh_token")
  );
}
