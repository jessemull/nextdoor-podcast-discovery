import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { auth0 } from "./lib/auth0";

const PUBLIC_PATHS = ["/auth", "/login"];

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export default async function middleware(request: NextRequest) {
  const response = await auth0.middleware(request);

  if (isPublicPath(request.nextUrl.pathname)) {
    return response;
  }

  const session = await auth0.getSession(request);

  if (!session) {
    const returnTo = encodeURIComponent(request.nextUrl.pathname + request.nextUrl.search);
    return NextResponse.redirect(new URL(`/auth/login?returnTo=${returnTo}`, request.url));
  }

  return response;
}

export const config = {
  matcher: ["/((?!login|_next/static|_next/image|favicon.ico).*)"],
};
