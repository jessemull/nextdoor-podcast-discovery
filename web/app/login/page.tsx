"use client";

import { Eye, EyeOff } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";

import { Spinner } from "@/components/ui/Spinner";
import { getSupabase } from "@/lib/supabase.client";
import { cn } from "@/lib/utils";

/** Supabase listFactors returns factors in data.all with factor_type and status (e.g. "verified" | "unverified"). */
function getTotpFactorsFromListFactorsResponse(data: unknown): { id: string; status?: string }[] {
  const all = (data as { all?: { id: string; factor_type?: string; status?: string }[] })?.all ?? [];
  return all
    .filter((f) => f.factor_type === "totp")
    .map((f) => ({ id: f.id, status: f.status }));
}

/** Allow only same-origin paths for post-login redirect (prevent open redirect). */
function getSafeReturnTo(returnTo: string | null): string {
  const path = (returnTo ?? "").trim() || "/";
  if (!path.startsWith("/") || path.includes("//")) {
    return "/dashboard";
  }
  if (path === "/") {
    return "/dashboard";
  }
  return path;
}

/** Supabase returns { code: "mfa_factor_name_conflict", message: "A factor with the friendly name \"\" for this user already exists" } */
function isMfaFactorNameConflict(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as { code?: string; message?: string };
  return (
    e.code === "mfa_factor_name_conflict" ||
    (typeof e.message === "string" &&
      e.message.includes("mfa_factor_name_conflict"))
  );
}

function LoginContent() {
  const searchParams = useSearchParams();
  const returnTo = getSafeReturnTo(searchParams.get("returnTo"));
  const reason = searchParams.get("reason");

  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [mfaError, setMfaError] = useState<string | null>(null);
  const [mfaCode, setMfaCode] = useState("");
  const [mfaMode, setMfaMode] = useState<"none" | "enroll" | "verify">("none");
  const [mfaFactorId, setMfaFactorId] = useState<string | null>(null);
  const [mfaChallengeId, setMfaChallengeId] = useState<string | null>(null);
  const [mfaQrCode, setMfaQrCode] = useState<string | null>(null);
  const [mfaSecret, setMfaSecret] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotError, setForgotError] = useState<string | null>(null);
  const [forgotSuccess, setForgotSuccess] = useState(false);
  const [forgotSubmitting, setForgotSubmitting] = useState(false);

  const handleForgotSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setForgotError(null);
      setForgotSubmitting(true);
      try {
        const supabase = getSupabase();
        // Must be an absolute URL including path so the reset email sends users to /reset-password
        const redirectTo =
          typeof window !== "undefined"
            ? new URL("/reset-password", window.location.origin).href
            : "";
        if (!redirectTo) {
          setForgotError("Could not determine reset URL. Please try again.");
          setForgotSubmitting(false);
          return;
        }
        const { error: resetError } = await supabase.auth.resetPasswordForEmail(
          email.trim(),
          { redirectTo }
        );
        if (resetError) {
          setForgotError(resetError.message);
          setForgotSubmitting(false);
          return;
        }
        setForgotSuccess(true);
      } catch {
        setForgotError("Something went wrong. Please try again.");
      } finally {
        setForgotSubmitting(false);
      }
    },
    [email]
  );

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError(null);
      setMfaError(null);
      setIsSubmitting(true);

      try {
        const supabase = getSupabase();
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });

        if (signInError) {
          setError(signInError.message);
          setIsSubmitting(false);
          return;
        }

        // After successful password sign-in, enforce TOTP:
        // 1) See if any TOTP factors exist.
        const { data: factorsData, error: factorsError } = await (supabase.auth as any).mfa.listFactors();
        if (factorsError) {
          throw factorsError;
        }

        const totpFactors = getTotpFactorsFromListFactorsResponse(factorsData);
        const hasVerifiedTotp = totpFactors.some((f) => f.status === "verified");

        if (!totpFactors || totpFactors.length === 0) {
          // No TOTP enrolled yet (or Supabase isn't reporting it): start enrollment.
          const { data: enrollData, error: enrollError } = await (supabase.auth as any).mfa.enroll({
            factorType: "totp",
          });
          if (enrollError) {
            // Stale incomplete factor (e.g. user left enrollment page and came back later).
            // Remove it and show a fresh QR instead of leaving them stuck on verify.
            if (isMfaFactorNameConflict(enrollError)) {
              const { data: retryFactors } = await (supabase.auth as any).mfa.listFactors();
              const retryTotp = getTotpFactorsFromListFactorsResponse(retryFactors);

              if (retryTotp && retryTotp.length > 0) {
                const existingFactorId = retryTotp[0].id;
                const { error: unenrollErr } = await (supabase.auth as any).mfa.unenroll({
                  factorId: existingFactorId,
                });
                if (unenrollErr) {
                  throw unenrollErr;
                }
                const { data: retryEnrollData, error: retryEnrollErr } = await (supabase.auth as any).mfa.enroll({
                  factorType: "totp",
                });
                if (retryEnrollErr) {
                  throw retryEnrollErr;
                }
                const retryFactorId = retryEnrollData?.id;
                const retryQrCode = retryEnrollData?.totp?.qr_code;
                const retrySecret = retryEnrollData?.totp?.secret;
                if (!retryFactorId) {
                  throw new Error("Missing factor id from enrollment response.");
                }
                const { data: retryChallengeData, error: retryChallengeError } =
                  await (supabase.auth as any).mfa.challenge({
                    factorId: retryFactorId,
                  });
                if (retryChallengeError) {
                  throw retryChallengeError;
                }
                const retryChallengeId = retryChallengeData?.id;
                if (!retryChallengeId) {
                  throw new Error("Missing challenge id for MFA enrollment.");
                }
                setMfaMode("enroll");
                setMfaFactorId(retryFactorId);
                setMfaChallengeId(retryChallengeId);
                setMfaQrCode(retryQrCode ?? null);
                setMfaSecret(retrySecret ?? null);
                setMfaCode("");
                setIsSubmitting(false);
                return;
              }
            }

            throw enrollError;
          }

          const factorId: string | undefined = enrollData?.id;
          const qrCode: string | undefined = enrollData?.totp?.qr_code;
          const secret: string | undefined = enrollData?.totp?.secret;
          if (!factorId) {
            throw new Error("Missing factor id from enrollment response.");
          }

          const { data: challengeData, error: challengeError } = await (supabase.auth as any).mfa
            .challenge({
              factorId,
            });
          if (challengeError) {
            throw challengeError;
          }
          const challengeId: string | undefined = challengeData?.id;
          if (!challengeId) {
            throw new Error("Missing challenge id for MFA enrollment.");
          }

          setMfaMode("enroll");
          setMfaFactorId(factorId);
          setMfaChallengeId(challengeId);
          setMfaQrCode(qrCode ?? null);
          setMfaSecret(secret ?? null);
          setMfaCode("");
          setIsSubmitting(false);
          return;
        }

        if (totpFactors.length > 0 && !hasVerifiedTotp) {
          // Incomplete enrollment (all TOTP factors are unverified). Remove and show QR again.
          const existingFactorId = totpFactors[0].id;
          const { error: unenrollErr } = await (supabase.auth as any).mfa.unenroll({
            factorId: existingFactorId,
          });
          if (unenrollErr) {
            throw unenrollErr;
          }
          const { data: enrollData, error: enrollError } = await (supabase.auth as any).mfa.enroll({
            factorType: "totp",
          });
          if (enrollError) {
            throw enrollError;
          }
          const factorId = enrollData?.id;
          const qrCode = enrollData?.totp?.qr_code;
          const secret = enrollData?.totp?.secret;
          if (!factorId) {
            throw new Error("Missing factor id from enrollment response.");
          }
          const { data: challengeData, error: challengeError } = await (supabase.auth as any).mfa
            .challenge({
              factorId,
            });
          if (challengeError) {
            throw challengeError;
          }
          const challengeId = challengeData?.id;
          if (!challengeId) {
            throw new Error("Missing challenge id for MFA enrollment.");
          }
          setMfaMode("enroll");
          setMfaFactorId(factorId);
          setMfaChallengeId(challengeId);
          setMfaQrCode(qrCode ?? null);
          setMfaSecret(secret ?? null);
          setMfaCode("");
          setIsSubmitting(false);
          return;
        }

        // TOTP already enrolled and verified: require verification.
        const factorId = totpFactors[0].id;
        const { data: challengeData, error: challengeError } = await (supabase.auth as any).mfa.challenge({
          factorId,
        });
        if (challengeError) {
          throw challengeError;
        }
        const challengeId: string | undefined = challengeData?.id;
        if (!challengeId) {
          throw new Error("Missing challenge id for MFA verification.");
        }

        setMfaMode("verify");
        setMfaFactorId(factorId);
        setMfaChallengeId(challengeId);
        setMfaQrCode(null);
        setMfaSecret(null);
        setMfaCode("");
        setIsSubmitting(false);
      } catch (err) {
        if (isMfaFactorNameConflict(err)) {
          try {
            const supabase = getSupabase();
            const { data: retryFactors } = await (supabase.auth as any).mfa.listFactors();
            const retryTotp = getTotpFactorsFromListFactorsResponse(retryFactors);

            if (retryTotp.length > 0) {
              const existingFactorId = retryTotp[0].id;
              const { error: unenrollErr } = await (supabase.auth as any).mfa.unenroll({
                factorId: existingFactorId,
              });
              if (unenrollErr) throw unenrollErr;

              const { data: retryEnrollData, error: retryEnrollErr } = await (supabase.auth as any).mfa.enroll({
                factorType: "totp",
              });
              if (retryEnrollErr) throw retryEnrollErr;

              const retryFactorId = retryEnrollData?.id;
              const retryQrCode = retryEnrollData?.totp?.qr_code;
              const retrySecret = retryEnrollData?.totp?.secret;
              if (!retryFactorId) throw new Error("Missing factor id from enrollment response.");

              const { data: retryChallengeData, error: retryChallengeError } =
                await (supabase.auth as any).mfa.challenge({
                  factorId: retryFactorId,
                });
              if (retryChallengeError) throw retryChallengeError;
              const retryChallengeId = retryChallengeData?.id;
              if (!retryChallengeId) throw new Error("Missing challenge id for MFA enrollment.");

              setMfaMode("enroll");
              setMfaFactorId(retryFactorId);
              setMfaChallengeId(retryChallengeId);
              setMfaQrCode(retryQrCode ?? null);
              setMfaSecret(retrySecret ?? null);
              setMfaCode("");
            } else {
              setError("Something went wrong. Please try again.");
            }
          } catch {
            setError("Something went wrong. Please try again.");
          }
        } else {
          setError("Something went wrong. Please try again.");
        }
        setIsSubmitting(false);
      }
    },
    [email, password]
  );

  const handleVerifyMfa = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!mfaFactorId || !mfaChallengeId || mfaCode.trim().length === 0) {
        return;
      }

      setMfaError(null);
      setIsSubmitting(true);

      try {
        const supabase = getSupabase();
        const { error: verifyError } = await (supabase.auth as any).mfa.verify({
          challengeId: mfaChallengeId,
          code: mfaCode.trim(),
          factorId: mfaFactorId,
        });
        if (verifyError) {
          throw verifyError;
        }

        // Let the client persist the new session to cookies before the next request.
        await supabase.auth.getSession();
        await new Promise((r) => setTimeout(r, 200));
        window.location.href = returnTo;
      } catch (err) {
        console.error("[login] MFA verify error", err);
        setMfaError("Invalid code. Please double-check and try again.");
        setIsSubmitting(false);
      }
    },
    [mfaCode, mfaChallengeId, mfaFactorId, returnTo]
  );

  const handleResetMfaAndShowQr = useCallback(async () => {
    if (!mfaFactorId) {
      return;
    }

    setMfaError(null);
    setIsSubmitting(true);

    try {
      const supabase = getSupabase();

      const { error: unenrollError } = await (supabase.auth as any).mfa.unenroll({
        factorId: mfaFactorId,
      });
      if (unenrollError) {
        throw unenrollError;
      }

      const { data: factorsData, error: factorsError } = await (supabase.auth as any).mfa.listFactors();
      if (factorsError) {
        throw factorsError;
      }

      const totpFactors = getTotpFactorsFromListFactorsResponse(factorsData);

      if (totpFactors.length > 0) {
        setMfaError("Could not remove previous setup. Please try again or contact support.");
        setIsSubmitting(false);
        return;
      }

      const { data: enrollData, error: enrollError } = await (supabase.auth as any).mfa.enroll({
        factorType: "totp",
      });
      if (enrollError) {
        throw enrollError;
      }

      const factorId: string | undefined = enrollData?.id;
      const qrCode: string | undefined = enrollData?.totp?.qr_code;
      const secret: string | undefined = enrollData?.totp?.secret;
      if (!factorId) {
        throw new Error("Missing factor id from enrollment response.");
      }

      const { data: challengeData, error: challengeError } = await (supabase.auth as any).mfa
        .challenge({
          factorId,
        });
      if (challengeError) {
        throw challengeError;
      }
      const challengeId: string | undefined = challengeData?.id;
      if (!challengeId) {
        throw new Error("Missing challenge id for MFA enrollment.");
      }

      setMfaMode("enroll");
      setMfaFactorId(factorId);
      setMfaChallengeId(challengeId);
      setMfaQrCode(qrCode ?? null);
      setMfaSecret(secret ?? null);
      setMfaCode("");
    } catch (err) {
      console.error("[login] reset MFA error", err);
      setMfaError(
        err instanceof Error ? err.message : "Could not start over. Please try again."
      );
    } finally {
      setIsSubmitting(false);
    }
  }, [mfaFactorId]);

  const isInMfaFlow = mfaMode !== "none";

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface">
      <div className="bg-surface-elevated mx-4 w-full max-w-md rounded-2xl border border-border p-8 shadow-2xl">
        <div className="mb-8 text-center">
          <h1 className="mb-2 text-3xl font-bold text-foreground">
            Nextdoor Discovery
          </h1>
          <p className="text-white">
            Sign in to access the podcast discovery dashboard.
          </p>
        </div>

        {!isInMfaFlow && searchParams.get("message") === "password_reset" && (
          <p className="mb-4 rounded-lg border border-green-200 bg-green-50 px-4 py-2 text-sm text-green-800">
            Your password has been updated. Sign in with your new password.
          </p>
        )}

        {!isInMfaFlow && reason === "auth_error" && (
          <p className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800">
            Your session may have expired. Please sign in again.
          </p>
        )}

        {!isInMfaFlow && showForgotPassword ? (
          <form onSubmit={handleForgotSubmit}>
            <div className="mb-4">
              <label
                className="mb-1 block text-sm font-medium text-white"
                htmlFor="forgot-email"
              >
                Email
              </label>
              <input
                autoComplete="email"
                className="border-border bg-background w-full rounded-lg border px-3 py-2 text-foreground focus:border-border-focus focus:outline-none focus:ring-2 focus:ring-border-focus"
                id="forgot-email"
                placeholder="Enter e-mail..."
                required
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            {forgotError && (
              <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-800">
                {forgotError}
              </p>
            )}
            {forgotSuccess ? (
              <p className="mb-4 rounded-lg border border-green-200 bg-green-50 px-4 py-2 text-sm text-green-800">
                If an account exists, we&apos;ve sent a reset link to that email.
              </p>
            ) : null}
            <button
              className={cn(
                "block w-full rounded-lg px-6 py-3 text-center font-medium transition-all duration-200",
                "bg-surface-hover text-foreground border border-border",
                "hover:bg-surface-hover/80 focus:outline-none focus:ring-2 focus:ring-border-focus focus:ring-offset-2",
                "disabled:cursor-not-allowed disabled:opacity-60",
                "inline-flex items-center justify-center gap-2"
              )}
              disabled={forgotSubmitting}
              type="submit"
            >
              {forgotSubmitting && <Spinner size="sm" />}
              Send Reset Link
            </button>
            <p className="mt-4 text-center text-sm text-muted">
              <button
                className="text-foreground underline hover:no-underline"
                type="button"
                onClick={() => {
                  setShowForgotPassword(false);
                  setForgotError(null);
                  setForgotSuccess(false);
                }}
              >
                Back To Sign In
              </button>
            </p>
          </form>
        ) : !isInMfaFlow ? (
          <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label
              className="mb-1 block text-sm font-medium text-white"
              htmlFor="login-email"
            >
              Email
            </label>
            <input
              autoComplete="email"
              className="border-border bg-background w-full rounded-lg border px-3 py-2 text-foreground focus:border-border-focus focus:outline-none focus:ring-2 focus:ring-border-focus"
              id="login-email"
              name="email"
              placeholder="Enter e-mail..."
              required
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="mb-6">
            <label
              className="mb-1 block text-sm font-medium text-white"
              htmlFor="login-password"
            >
              Password
            </label>
            <div className="relative">
              <input
                autoComplete="current-password"
                className="border-border bg-background w-full rounded-lg border px-3 py-2 pr-10 text-foreground focus:border-border-focus focus:outline-none focus:ring-2 focus:ring-border-focus"
                id="login-password"
                name="password"
                placeholder="Enter password..."
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

          {error && (
            <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-800">
              {error}
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
            Sign In
          </button>
          <p className="mt-4 text-center text-sm text-muted">
            <button
              className="text-foreground underline hover:no-underline"
              type="button"
              onClick={() => setShowForgotPassword(true)}
            >
              Forgot Password?
            </button>
          </p>
          </form>
        ) : null}

        {isInMfaFlow && (
          <form onSubmit={handleVerifyMfa}>
            <div className="mb-4">
              <h2 className="mb-1 text-lg font-semibold text-foreground">
                {mfaMode === "enroll" ? "Set up two-factor authentication" : "Two-factor authentication"}
              </h2>
              <p className="text-sm text-muted">
                {mfaMode === "enroll"
                  ? "Scan the QR code with your authenticator app, then enter the 6-digit code."
                  : "Enter the 6-digit code from your authenticator app."}
              </p>
            </div>

            {mfaMode === "enroll" && (mfaQrCode || mfaSecret) && (
              <div className="mb-4 space-y-3">
                {mfaQrCode ? (
                  <div className="flex justify-center">
                    <div
                      className="rounded-md bg-white p-3"
                      dangerouslySetInnerHTML={{
                        __html: decodeURIComponent(
                          mfaQrCode.split(",")[1] ?? ""
                        ),
                      }}
                    />
                  </div>
                ) : null}
                {mfaSecret && (
                  <div className="rounded-md border border-border bg-background px-3 py-2 text-sm font-mono text-foreground">
                    {mfaSecret}
                  </div>
                )}
              </div>
            )}

            <div className="mb-4">
              <label
                className="mb-1 block text-sm font-medium text-white"
                htmlFor="mfa-code"
              >
                6-Digit Code
              </label>
              <input
                className="border-border bg-background w-full rounded-lg border px-3 py-2 text-foreground focus:border-border-focus focus:outline-none focus:ring-2 focus:ring-border-focus"
                id="mfa-code"
                inputMode="numeric"
                maxLength={6}
                placeholder="Enter code"
                value={mfaCode}
                onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, ""))}
              />
            </div>

            {mfaError && (
              <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-800">
                {mfaError}
              </p>
            )}

            <div className="mt-2 flex items-center gap-3">
              <button
                className={cn(
                  "w-1/2 rounded-lg px-4 py-2 text-center text-sm font-medium transition-all duration-200",
                  "bg-surface-hover text-foreground border border-border",
                  "hover:bg-surface-hover/80 focus:outline-none focus:ring-2 focus:ring-border-focus focus:ring-offset-2",
                  "disabled:cursor-not-allowed disabled:opacity-60",
                  "inline-flex items-center justify-center gap-2"
                )}
                disabled={isSubmitting || mfaCode.length === 0}
                type="submit"
              >
                {isSubmitting && <Spinner size="sm" />}
                Verify Code
              </button>
              <button
                className="w-1/2 rounded-lg border border-border bg-transparent px-4 py-2 text-center text-sm font-medium text-muted hover:bg-surface-hover/40 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={isSubmitting}
                type="button"
                onClick={() => {
                  setMfaMode("none");
                  setMfaCode("");
                  setMfaError(null);
                }}
              >
                Back
              </button>
            </div>

            {mfaMode === "enroll" ? (
              <p className="mt-4 text-center text-sm text-muted">
                Didn’t finish setting up?{" "}
                <button
                  className="text-foreground underline hover:no-underline"
                  disabled={isSubmitting}
                  type="button"
                  onClick={handleResetMfaAndShowQr}
                >
                  Start over and show QR code again
                </button>
              </p>
            ) : null}
          </form>
        )}

        {!isInMfaFlow && (
          <p className="mt-6 text-center text-sm text-gray-500">
            Access is restricted to authorized users only.
          </p>
        )}
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-surface">
          <div className="flex flex-col items-center gap-3">
            <div className="h-10 w-10 animate-spin rounded-full border-2 border-border/30 border-t-white" />
            <p className="text-sm text-muted">
              Loading sign-in experience&hellip;
            </p>
          </div>
        </div>
      }
    >
      <LoginContent />
    </Suspense>
  );
}
