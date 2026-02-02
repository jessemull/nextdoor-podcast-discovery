/**
 * Environment variable validation and typed access.
 * 
 * This module provides safe access to environment variables with
 * validation to fail fast if required variables are missing.
 */

function getEnvVar(name: string, required: boolean = true): string {
  const value = process.env[name];
  if (required && !value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value || "";
}

// Server-side environment variables (not exposed to client)
export const env = {
  // Supabase
  get SUPABASE_URL() {
    return getEnvVar("SUPABASE_URL");
  },
  get SUPABASE_SERVICE_KEY() {
    return getEnvVar("SUPABASE_SERVICE_KEY");
  },

  // Auth
  get NEXTAUTH_SECRET() {
    return getEnvVar("NEXTAUTH_SECRET");
  },
  get GOOGLE_CLIENT_ID() {
    return getEnvVar("GOOGLE_CLIENT_ID");
  },
  get GOOGLE_CLIENT_SECRET() {
    return getEnvVar("GOOGLE_CLIENT_SECRET");
  },

  // Users
  get ALLOWED_EMAIL_1() {
    return getEnvVar("ALLOWED_EMAIL_1", false);
  },
  get MATT_EMAIL() {
    return getEnvVar("MATT_EMAIL", false);
  },

  // Claude
  get ANTHROPIC_API_KEY() {
    return getEnvVar("ANTHROPIC_API_KEY");
  },
};

// Client-side environment variables (exposed via NEXT_PUBLIC_)
export const clientEnv = {
  get SUPABASE_URL() {
    return getEnvVar("NEXT_PUBLIC_SUPABASE_URL");
  },
  get SUPABASE_ANON_KEY() {
    return getEnvVar("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  },
  get MATT_EMAIL() {
    return getEnvVar("NEXT_PUBLIC_MATT_EMAIL", false);
  },
};

// Claude model configuration
export const CLAUDE_MODEL = "claude-3-haiku-20240307";
