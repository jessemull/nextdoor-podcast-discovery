"use client";

import { Eye, EyeOff } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Suspense,
  useCallback,
  useEffect,
  useReducer,
  useState,
} from "react";

import { getTotpFactorsFromListFactorsResponse } from "@/app/login/login-utils";
import { Spinner } from "@/components/ui/Spinner";
import { isInvalidRefreshTokenError } from "@/lib/auth-errors";
import { getMfaApi } from "@/lib/supabase-mfa.client";
import { getSupabase } from "@/lib/supabase.client";
import { cn } from "@/lib/utils";

import type { FormEvent } from "react";

type Phase = "error" | "invalid" | "loading" | "mfa" | "password";

function ResetPasswordContent() {
  const router = useRouter();
  const [phase, dispatchPhase] = useReducer(
    (_state: Phase, action: Phase) => action,
    "loading" as Phase
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [mfaBootstrapError, setMfaBootstrapError] = useState<string | null>(
    null
  );
  const [mfaChallengeId, setMfaChallengeId] = useState<string | null>(null);
  const [mfaCode, setMfaCode] = useState("");
  const [mfaError, setMfaError] = useState<string | null>(null);
  const [mfaFactorId, setMfaFactorId] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmittingMfa, setIsSubmittingMfa] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const supabase = getSupabase();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (cancelled) return;
      if (!user) {
        dispatchPhase("invalid");
        return;
      }

      const { data: factorsData, error: factorsError } =
        await getMfaApi(supabase).listFactors();
      if (cancelled) return;
      if (factorsError) {
        setMfaBootstrapError(factorsError.message);
        dispatchPhase("error");
        return;
      }

      const totpFactors = getTotpFactorsFromListFactorsResponse(factorsData);
      const verified = totpFactors.filter((f) => f.status === "verified");
      if (verified.length === 0) {
        dispatchPhase("password");
        return;
      }

      const factorId = verified[0].id;
      const { data: challengeData, error: challengeError } =
        await getMfaApi(supabase).challenge({
          factorId,
        });
      if (cancelled) return;
      if (challengeError) {
        setMfaBootstrapError(challengeError.message);
        dispatchPhase("error");
        return;
      }
      const challengeId = challengeData?.id;
      if (!challengeId) {
        setMfaBootstrapError("Could not start two-factor verification.");
        dispatchPhase("error");
        return;
      }

      setMfaFactorId(factorId);
      setMfaChallengeId(challengeId);
      dispatchPhase("mfa");
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleBackToSignIn = useCallback(async () => {
    await getSupabase().auth.signOut();
    router.push("/login");
  }, [router]);

  const handleSubmit = useCallback(
    async (e: FormEvent) => {
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

  const handleVerifyMfa = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      if (!mfaFactorId || !mfaChallengeId || mfaCode.trim().length === 0) {
        return;
      }

      setMfaError(null);
      setIsSubmittingMfa(true);

      try {
        const supabase = getSupabase();
        const { error: verifyError } = await getMfaApi(supabase).verify({
          challengeId: mfaChallengeId,
          code: mfaCode.trim(),
          factorId: mfaFactorId,
        });
        if (verifyError) {
          throw verifyError;
        }

        await supabase.auth.getSession();
        await new Promise((r) => setTimeout(r, 200));
        setMfaCode("");
        dispatchPhase("password");
      } catch (err) {
        if (isInvalidRefreshTokenError(err)) {
          await getSupabase().auth.signOut();
          setMfaError(
            "Session could not be established. Please start over from the reset link."
          );
        } else {
          setMfaError("Invalid code. Please double-check and try again.");
        }
      } finally {
        setIsSubmittingMfa(false);
      }
    },
    [mfaChallengeId, mfaCode, mfaFactorId]
  );

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface">
      <div className="bg-surface-elevated mx-4 w-full max-w-md rounded-2xl border border-border p-8 shadow-2xl">
        <div className="mb-8 text-center">
          <h1 className="mb-2 text-3xl font-bold text-foreground">
            Nextdoor Discovery
          </h1>
          <p className="text-white">Set a new password for your account.</p>
        </div>

        {phase === "loading" && (
          <p className="text-muted text-center text-sm">Checking session…</p>
        )}

        {phase === "error" && mfaBootstrapError && (
          <>
            <p className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800">
              {mfaBootstrapError}
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

        {phase === "invalid" && (
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

        {phase === "mfa" && (
          <form onSubmit={handleVerifyMfa}>
            <div className="mb-4">
              <h2 className="mb-1 text-lg font-semibold text-foreground">
                Two-factor authentication
              </h2>
              <p className="text-sm text-muted">
                Enter the 6-digit code from your authenticator app to continue.
              </p>
            </div>
            <div className="mb-4">
              <label
                className="mb-1 block text-sm font-medium text-white"
                htmlFor="reset-mfa-code"
              >
                6-Digit Code
              </label>
              <input
                className="border-border bg-background w-full rounded-lg border px-3 py-2 text-foreground focus:border-border-focus focus:outline-none focus:ring-2 focus:ring-border-focus"
                id="reset-mfa-code"
                inputMode="numeric"
                maxLength={6}
                placeholder="Enter code"
                value={mfaCode}
                onChange={(e) =>
                  setMfaCode(e.target.value.replace(/\D/g, ""))
                }
              />
            </div>
            {mfaError && (
              <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-800">
                {mfaError}
              </p>
            )}
            <div className="flex items-center gap-3">
              <button
                className={cn(
                  "w-1/2 rounded-lg px-4 py-2 text-center text-sm font-medium transition-all duration-200",
                  "bg-surface-hover text-foreground border border-border",
                  "hover:bg-surface-hover/80 focus:outline-none focus:ring-2 focus:ring-border-focus focus:ring-offset-2",
                  "disabled:cursor-not-allowed disabled:opacity-60",
                  "inline-flex items-center justify-center gap-2"
                )}
                disabled={isSubmittingMfa || mfaCode.length === 0}
                type="submit"
              >
                {isSubmittingMfa && <Spinner size="sm" />}
                Verify Code
              </button>
              <button
                className="w-1/2 rounded-lg border border-border bg-transparent px-4 py-2 text-center text-sm font-medium text-muted hover:bg-surface-hover/40 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={isSubmittingMfa}
                type="button"
                onClick={handleBackToSignIn}
              >
                Back To Sign In
              </button>
            </div>
          </form>
        )}

        {phase === "password" && (
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
                "disabled:cursor-not-allowed disabled:opacity-60",
                "inline-flex items-center justify-center gap-2"
              )}
              disabled={isSubmitting}
              type="submit"
            >
              {isSubmitting && <Spinner size="sm" />}
              Set New Password
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
        <div className="flex min-h-screen items-center justify-center bg-surface">
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
