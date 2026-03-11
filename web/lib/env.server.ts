/**
 * Server-side environment variables.
 *
 * This module should ONLY be imported in:
 * - API routes (app/api/)
 * - Server components
 * - Server actions
 *
 * NEVER import this in client components or "use client" files.
 */

import "server-only";

function getEnvVar(name: string, required: boolean = true): string {
  const value = process.env[name];
  if (required && !value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value || "";
}

export const env = {
  get ANTHROPIC_API_KEY() {
    return getEnvVar("ANTHROPIC_API_KEY");
  },
  get OPENAI_API_KEY() {
    return getEnvVar("OPENAI_API_KEY");
  },
  get SUPABASE_SERVICE_KEY() {
    return getEnvVar("SUPABASE_SERVICE_KEY");
  },
  get SUPABASE_URL() {
    return getEnvVar("SUPABASE_URL");
  },
};

// Claude model configuration

export const CLAUDE_MODEL = "claude-3-haiku-20240307";
