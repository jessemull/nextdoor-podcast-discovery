/**
 * Auth0 session helper for API routes that logs [auth-session-missing] when
 * unauthenticated, so 401s (e.g. from mobile requests without the cookie) show
 * up in logs and match the same diagnostic as layout/middleware redirects.
 */

import "server-only";

import { auth0 } from "@/lib/auth0";

import type { NextRequest } from "next/server";

/**
 * Get the current session. If there is no session, logs [auth-session-missing]
 * with request path, user-agent, and session cookie presence, then returns null.
 * Use in API route handlers so 401 responses are diagnosed the same as redirects.
 * Request may be undefined in test environments.
 */
export async function getSessionWithAuthLog(
  request?: NextRequest
): Promise<Awaited<ReturnType<typeof auth0.getSession>>> {
  const session = await auth0.getSession();
  if (!session) {
    const sessionCookiePresent =
      request?.cookies?.getAll()?.some((c) => c.name.startsWith("__session")) ??
      false;
    console.error("[auth-session-missing]", {
      host: request?.headers?.get("host"),
      path: request?.nextUrl?.pathname,
      referer: request?.headers?.get("referer"),
      sessionCookiePresent,
      userAgent: request?.headers?.get("user-agent"),
    });
  }
  return session;
}
