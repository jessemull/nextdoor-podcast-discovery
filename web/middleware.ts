import { InvalidStateError } from "@auth0/nextjs-auth0/errors";
import { NextResponse } from "next/server";

import { auth0 } from "./lib/auth0";

import type { NextRequest } from "next/server";

function isInvalidStateError(error: unknown): error is InvalidStateError {
  return error instanceof InvalidStateError;
}

export default async function middleware(request: NextRequest) {
  try {
    const response = await auth0.middleware(request);
    if (
      response.status >= 300 &&
      response.status < 400 &&
      response.headers.get("location")?.includes("/auth/login")
    ) {
      const sessionCookiePresent = request.cookies
        .getAll()
        .some((c) => c.name.startsWith("__session"));
      console.error("[auth-session-missing]", {
        host: request.headers.get("host"),
        path: request.nextUrl.pathname,
        referer: request.headers.get("referer"),
        sessionCookiePresent,
        userAgent: request.headers.get("user-agent"),
      });
      const location = response.headers.get("location");
      if (location) {
        const loginUrl = new URL(location, request.url);
        loginUrl.searchParams.set("_diag_cookie", sessionCookiePresent ? "1" : "0");
        return NextResponse.redirect(loginUrl, response.status as 301 | 302 | 303 | 307 | 308);
      }
    }
    return response;
  } catch (error) {
    const path = request.nextUrl.pathname;
    const userAgent = request.headers.get("user-agent") ?? "";
    const isAuthPath = path.startsWith("/auth/");

    if (isInvalidStateError(error)) {
      console.error("[auth-callback]", {
        name: error.name,
        path,
        userAgent,
      });
      return NextResponse.redirect(
        new URL("/login?reason=auth_error", request.url)
      );
    }

    if (isAuthPath) {
      const message = error instanceof Error ? error.message : String(error);
      const name = error instanceof Error ? error.constructor.name : typeof error;
      const stack = error instanceof Error ? error.stack : undefined;
      console.error("[auth-callback]", {
        name,
        path,
        stack,
        userAgent,
        error: message,
      });
      return NextResponse.redirect(
        new URL("/login?reason=auth_error", request.url)
      );
    }

    throw error;
  }
}

export const config = {
  matcher: ["/((?!api/auth|_next/image|_next/static|favicon.ico).*)"],
};
