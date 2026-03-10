import { InvalidStateError } from "@auth0/nextjs-auth0/errors";
import { NextResponse } from "next/server";

import { auth0 } from "./lib/auth0";

import type { NextRequest } from "next/server";

function isInvalidStateError(error: unknown): error is InvalidStateError {
  return error instanceof InvalidStateError;
}

export default async function middleware(request: NextRequest) {
  try {
    return await auth0.middleware(request);
  } catch (error) {
    if (isInvalidStateError(error)) {
      const path = request.nextUrl.pathname;
      const userAgent = request.headers.get("user-agent") ?? "";
      console.error("[auth-callback]", {
        name: error.name,
        path,
        userAgent,
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
