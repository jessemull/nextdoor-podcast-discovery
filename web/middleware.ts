import type { NextRequest } from "next/server";

import { auth0 } from "./lib/auth0";

export default async function middleware(request: NextRequest) {
  return auth0.middleware(request);
}

export const config = {
  matcher: ["/((?!login|_next/static|_next/image|favicon.ico).*)"],
};
