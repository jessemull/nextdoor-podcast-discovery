import { NextResponse } from "next/server";

import { createSupabaseAuthClientForMiddleware } from "./lib/supabase-server-auth";

import type { NextRequest } from "next/server";

const PUBLIC_PATHS = [
  "/",
  "/about",
  "/categories",
  "/episodes",
  "/feed.xml",
  "/login",
  "/reset-password",
  "/search",
  "/subscribe",
  "/sitemap.xml",
];
const STATIC_PATTERN =
  /^\/(_next|_next\/static|_next\/image|favicon\.ico|icon\.svg|.*\.(?:svg|png|jpg|jpeg|gif|webp)$)/;

export default async function middleware(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;

  if (STATIC_PATTERN.test(pathname)) {
    return NextResponse.next();
  }

  // Try server-side PKCE exchange for password reset so it works when the link
  // is opened in a new tab (same browser sends cookies with the request).
  const code = searchParams.get("code");
  if (pathname === "/reset-password" && code?.trim()) {
    const redirectUrl = new URL("/reset-password", request.url);
    const response = NextResponse.redirect(redirectUrl);
    const supabase = createSupabaseAuthClientForMiddleware(request, response);
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return response;
    }
    // Exchange failed (e.g. no verifier cookie in request); let the page load and show client error.
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
