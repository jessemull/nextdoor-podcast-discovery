import { NextResponse } from "next/server";

import { createSupabaseAuthClientForRouteHandler } from "@/lib/supabase-server-auth";

import type { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const token_hash = request.nextUrl.searchParams.get("token_hash");
  const type = request.nextUrl.searchParams.get("type");

  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("reason", "recovery_link_invalid");

  if (!token_hash?.trim() || type !== "recovery") {
    return NextResponse.redirect(loginUrl);
  }

  const resetUrl = new URL("/reset-password", request.url);
  const response = NextResponse.redirect(resetUrl);
  const supabase = createSupabaseAuthClientForRouteHandler(request, response);
  const { error } = await supabase.auth.verifyOtp({
    token_hash,
    type: "recovery",
  });

  if (error) {
    return NextResponse.redirect(loginUrl);
  }

  return response;
}
