"use client";

import { Eye, EyeOff } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useReducer, useRef, useState } from "react";

import { Spinner } from "@/components/ui/Spinner";
import { getSupabase } from "@/lib/supabase.client";
import { cn } from "@/lib/utils";

type Status = "loading" | "invalid" | "verified" | "error";

/** Visible on-page debug info so we can see state after redirects without console. */
interface PageDebug {
  cookieNames: string[];
  codeParamPresent: boolean;
  codeParamLength: number;
  exchangeError: string | null;
  localStorageKeysWithVerifier: string[];
  status: Status;
  urlSearch: string;
  verifierCookieNames: string[];
}

function getCookieNames(): string[] {
  if (typeof document === "undefined") return [];
  return document.cookie
    .split(";")
    .map((s) => s.trim().split("=")[0] ?? "")
    .filter(Boolean);
}

function getLocalStorageKeysContaining(substring: string): string[] {
  if (typeof localStorage === "undefined") return [];
  const keys: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.toLowerCase().includes(substring)) keys.push(key);
  }
  return keys;
}

function ResetPasswordContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const code = searchParams.get("code");
  const [status, dispatchStatus] = useReducer(
    (_state: Status, action: Status) => action,
    "loading" as Status
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const initialSearchRef = useRef<string | null>(null);
  const [debug, setDebug] = useState<PageDebug>({
    cookieNames: [],
    codeParamPresent: false,
    codeParamLength: 0,
    exchangeError: null,
    localStorageKeysWithVerifier: [],
    status: "loading",
    urlSearch: "",
    verifierCookieNames: [],
  });

  // Capture URL search once on first mount so we don't lose it after client nav
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (initialSearchRef.current === null) {
      initialSearchRef.current = window.location.search;
    }
  }, []);

  // Keep debug in sync with status/error and capture URL + cookies + localStorage
  useEffect(() => {
    if (typeof window === "undefined") return;
    const cookies = getCookieNames();
    const verifierCookies = cookies.filter(
      (n) =>
        n.includes("code-verifier") || n.includes("verifier")
    );
    setDebug((prev) => ({
      ...prev,
      codeParamLength: code?.length ?? 0,
      codeParamPresent: Boolean(code?.trim()),
      cookieNames: cookies,
      localStorageKeysWithVerifier: getLocalStorageKeysContaining("verifier"),
      status,
      urlSearch: initialSearchRef.current ?? window.location.search,
      verifierCookieNames: verifierCookies,
    }));
  }, [code, status]);

  // When we have a code: try client-side exchange. When we have no code: check for
  // existing session (e.g. server did the exchange and redirected here).
  useEffect(() => {
    let cancelled = false;
    if (!code?.trim()) {
      (async () => {
        const supabase = getSupabase();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (cancelled) return;
        dispatchStatus(user ? "verified" : "invalid");
      })();
      return () => {
        cancelled = true;
      };
    }
    (async () => {
      const supabase = getSupabase();
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (cancelled) return;
      if (error) {
        const cookies = getCookieNames();
        setErrorMessage(error.message);
        setDebug((prev) => ({
          ...prev,
          cookieNames: cookies,
          exchangeError: error.message,
          localStorageKeysWithVerifier: getLocalStorageKeysContaining("verifier"),
          verifierCookieNames: cookies.filter(
            (n) =>
              n.includes("code-verifier") || n.includes("verifier")
          ),
        }));
        dispatchStatus("error");
        return;
      }
      dispatchStatus("verified");
    })();
    return () => {
      cancelled = true;
    };
  }, [code]);

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
    <div className="flex min-h-screen items-center justify-center bg-surface">
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
            <p className="text-muted mb-4 text-xs">
              If you opened this link in a new tab, try copying the link and
              pasting it into the tab where you requested the reset.
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

        {/* Visible debug: survives redirects and works without console */}
        <details className="border-border bg-background/80 mt-6 rounded-lg border p-3">
          <summary className="cursor-pointer text-xs font-medium text-muted">
            Debug (reset flow)
          </summary>
          <p className="text-muted mt-2 text-xs">
            In DevTools → Application: check Cookies and Local Storage for keys
            containing &quot;code-verifier&quot;. Verifier must exist when you
            open the reset link (set when you clicked Send Reset Link).
          </p>
          <pre className="text-muted mt-2 whitespace-pre-wrap break-all text-xs">
            {JSON.stringify(
              {
                codeParamLength: debug.codeParamLength,
                codeParamPresent: debug.codeParamPresent,
                cookieNames: debug.cookieNames,
                exchangeError: debug.exchangeError ?? "(none)",
                status: debug.status,
                urlSearchFirstCapture: debug.urlSearch || "(empty)",
                verifierCookieNames: debug.verifierCookieNames,
                localStorageKeysWithVerifier:
                  debug.localStorageKeysWithVerifier,
              },
              null,
              2
            )}
          </pre>
        </details>
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
