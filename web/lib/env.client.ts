/**
 * Client-side environment variables.
 *
 * These are safe to use in client components.
 * All variables must be prefixed with NEXT_PUBLIC_.
 *
 * IMPORTANT: Use literal env keys so Next.js can inline them into the client bundle.
 */

export const clientEnv = {
  SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
  SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
};
