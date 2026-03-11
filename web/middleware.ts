import { NextResponse } from "next/server";

import { createSupabaseAuthClientForMiddleware } from "./lib/supabase-server-auth";

import type { NextRequest } from "next/server";

const PUBLIC_PATHS = ["/login"];
const STATIC_PATTERN =
  /^\/(_next|_next\/static|_next\/image|favicon\.ico|icon\.svg|.*\.(?:svg|png|jpg|jpeg|gif|webp)$)/;

export default async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (STATIC_PATTERN.test(pathname)) {
    return NextResponse.next();
  }

  if (PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    return NextResponse.next();
  }

  const response = NextResponse.next({ request });
  const supabase = createSupabaseAuthClientForMiddleware(request, response);

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isApiRoute = pathname.startsWith("/api/");
  if (!user && !isApiRoute) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("returnTo", pathname); // pathname is always same-origin
    return NextResponse.redirect(loginUrl);
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
