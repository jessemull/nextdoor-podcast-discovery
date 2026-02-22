"use client";

/**
 * Client-only fetch wrapper for authenticated API calls.
 * On 401, redirects to /login?reason=session_expired and throws so callers don't continue.
 * Use for all requests that require Auth0 session (posts, settings, admin, etc.).
 */
export async function authFetch(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  const response = await fetch(input, {
    ...init,
    credentials: "include",
  });

  if (response.status === 401) {
    window.location.href = "/login?reason=session_expired";
    throw new Error("Unauthorized");
  }

  return response;
}
