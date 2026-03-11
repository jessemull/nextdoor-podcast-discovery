/**
 * Server-side Supabase client for Auth (cookie-based session).
 * Use in Server Components, Route Handlers, and middleware.
 */

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import "server-only";

import type { NextRequest, NextResponse } from "next/server";

export interface AppSession {
  user: SessionUser;
}

export interface SessionUser {
  email: string;
  id: string;
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/**
 * Create a Supabase auth client for the current request (Server Components / Route Handlers).
 * Uses next/headers cookies. For middleware, use createSupabaseAuthClientForMiddleware instead.
 */
export async function createSupabaseAuthClient() {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are required for auth"
    );
  }

  const cookieStore = await cookies();

  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, options, value }) =>
            cookieStore.set(name, value, options)
          );
        } catch {
          // Ignore when called from Server Component (middleware will refresh)
        }
      },
    },
  });
}

/**
 * Create a Supabase auth client in middleware. Reads cookies from request,
 * writes updated cookies to response. Call get_user() to refresh session.
 */
export function createSupabaseAuthClientForMiddleware(
  request: NextRequest,
  response: NextResponse
) {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are required for auth"
    );
  }

  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, options, value }) =>
          response.cookies.set(name, value, options)
        );
      },
    },
  });
}

/**
 * Get the current session for authorization.
 * Returns a normalized shape compatible with existing API/layout code.
 * Returns null if not authenticated or if auth env vars are missing (e.g. during CI build).
 */
export async function getSession(): Promise<AppSession | null> {
  if (!supabaseUrl || !supabaseAnonKey) {
    return null;
  }

  const supabase = await createSupabaseAuthClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return null;
  }

  return {
    user: {
      email: user.email ?? "",
      id: user.id,
    },
  };
}
