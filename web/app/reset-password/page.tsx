"use client";

import { Eye, EyeOff } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";

import { getSupabase } from "@/lib/supabase.client";
import { cn } from "@/lib/utils";

type Status = "loading" | "invalid" | "verified" | "error";

function parseHashParams(): {
  access_token: string | null;
  token_hash: string | null;
  type: string | null;
} {
  if (typeof window === "undefined")
    return { access_token: null, token_hash: null, type: null };
  const hash = window.location.hash?.slice(1) || "";
  const params = new URLSearchParams(hash);
  return {
    access_token: params.get("access_token"),
    token_hash: params.get("token_hash"),
    type: params.get("type"),
  };
}

function ResetPasswordContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<Status>("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const hashParams = parseHashParams();
  const tokenHash = searchParams.get("token_hash") ?? hashParams.token_hash;
  const hasSessionFromHash = Boolean(hashParams.access_token);

  useEffect(() => {
    // Debug logging to help diagnose Supabase recovery redirects in different environments.
    // Only logs in the browser.
    if (typeof window !== "undefined") {
      // eslint-disable-next-line no-console
      console.debug("[reset-password] location", {
        hash: window.location.hash,
        search: window.location.search,
      });
      // eslint-disable-next-line no-console
      console.debug("[reset-password] parsed params", {
        accessTokenPresent: Boolean(hashParams.access_token),
        hasTokenHash: Boolean(tokenHash),
      });
    }

    let cancelled = false;
    if (tokenHash) {
      (async () => {
        const supabase = getSupabase();
        const { error } = await supabase.auth.verifyOtp({
          token_hash: tokenHash,
          type: "recovery",
        });
        if (cancelled) return;
        if (error) {
          setErrorMessage(error.message);
          setStatus("error");
          return;
        }
        setStatus("verified");
      })();
    } else if (hasSessionFromHash) {
      // Supabase already created a session and redirected here with tokens
      // in the URL fragment. Treat the link as verified and let updateUser enforce auth.
      setStatus("verified");
    } else {
      setStatus("invalid");
    }

    return () => {
      cancelled = true;
    };
  }, [hasSessionFromHash, tokenHash]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setErrorMessage(null);
      if (password !== confirmPassword) {
        setErrorMessage("Passwords do not match.");
        return;
      }
      if (password.length < 6) {
        setErrorMessage("Password must be at least 6 characters.");
        return;
      }
      setIsSubmitting(true);
      try {
        const supabase = getSupabase();
        const { error } = await supabase.auth.updateUser({ password });
        if (error) {
          setErrorMessage(error.message);
          setIsSubmitting(false);
          return;
        }
        router.replace("/login?message=password_reset");
      } catch {
        setErrorMessage("Something went wrong. Please try again.");
        setIsSubmitting(false);
      }
    },
    [password, confirmPassword, router]
  );

  return (
    <div className="flex h-full items-center justify-center bg-surface">
      <div className="bg-surface-elevated mx-4 w-full max-w-md rounded-2xl border border-border p-8 shadow-2xl">
        <div className="mb-8 text-center">
          <h1 className="mb-2 text-3xl font-bold text-foreground">
            Nextdoor Discovery
          </h1>
          <p className="text-white">Set a new password for your account.</p>
        </div>

        {status === "loading" && (
          <p className="text-muted text-center text-sm">Verifying link…</p>
        )}

        {status === "invalid" && (
          <>
            <p className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800">
              This link is invalid or has expired. Request a new password reset
              from the sign-in page.
            </p>
            <p className="text-center text-sm text-muted">
              <Link
                className="text-foreground underline hover:no-underline"
                href="/login"
              >
                Back To Sign In
              </Link>
            </p>
          </>
        )}

        {status === "error" && (
          <>
            <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-800">
              {errorMessage ?? "Verification failed."}
            </p>
            <p className="text-center text-sm text-muted">
              <Link
                className="text-foreground underline hover:no-underline"
                href="/login"
              >
                Back To Sign In
              </Link>
            </p>
          </>
        )}

        {status === "verified" && (
          <form onSubmit={handleSubmit}>
            <div className="mb-4">
              <label
                className="mb-1 block text-sm font-medium text-white"
                htmlFor="new-password"
              >
                New password
              </label>
              <div className="relative">
                <input
                  autoComplete="new-password"
                  className="border-border bg-background w-full rounded-lg border px-3 py-2 pr-10 text-foreground focus:border-border-focus focus:outline-none focus:ring-2 focus:ring-border-focus"
                  id="new-password"
                  minLength={6}
                  placeholder="Enter new password..."
                  required
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className="text-muted hover:text-foreground focus-visible:ring-border-focus absolute inset-y-0 right-0 flex items-center pr-3 text-sm focus:outline-none focus-visible:ring-2"
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                >
                  {showPassword ? (
                    <EyeOff aria-hidden className="h-4 w-4" />
                  ) : (
                    <Eye aria-hidden className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>
            <div className="mb-6">
              <label
                className="mb-1 block text-sm font-medium text-white"
                htmlFor="confirm-password"
              >
                Confirm password
              </label>
              <input
                autoComplete="new-password"
                className="border-border bg-background w-full rounded-lg border px-3 py-2 text-foreground focus:border-border-focus focus:outline-none focus:ring-2 focus:ring-border-focus"
                id="confirm-password"
                minLength={6}
                placeholder="Confirm new password..."
                required
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>
            {errorMessage && (
              <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-800">
                {errorMessage}
              </p>
            )}
            <button
              className={cn(
                "block w-full rounded-lg px-6 py-3 text-center font-medium transition-all duration-200",
                "bg-surface-hover text-foreground border border-border",
                "hover:bg-surface-hover/80 focus:outline-none focus:ring-2 focus:ring-border-focus focus:ring-offset-2",
                "disabled:cursor-not-allowed disabled:opacity-60"
              )}
              disabled={isSubmitting}
              type="submit"
            >
              {isSubmitting ? "Updating…" : "Set New Password"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-full items-center justify-center bg-surface">
          <div className="flex flex-col items-center gap-3">
            <div className="h-10 w-10 animate-spin rounded-full border-2 border-border/30 border-t-white" />
            <p className="text-sm text-muted">Loading…</p>
          </div>
        </div>
      }
    >
      <ResetPasswordContent />
    </Suspense>
  );
}
