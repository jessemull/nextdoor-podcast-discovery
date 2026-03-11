"use client";

import { Eye, EyeOff } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";

import { getSupabase } from "@/lib/supabase.client";
import { useAuthUser } from "@/lib/useAuthUser.client";
import { cn } from "@/lib/utils";

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnTo = searchParams.get("returnTo") ?? "/";
  const reason = searchParams.get("reason");
  const { isLoading: authLoading, user } = useAuthUser();

  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError(null);
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

        router.push(returnTo);
        router.refresh();
      } catch {
        setError("Something went wrong. Please try again.");
        setIsSubmitting(false);
      }
    },
    [email, password, returnTo, router]
  );

  useEffect(() => {
    if (!authLoading && user) {
      router.push(returnTo);
      router.refresh();
    }
  }, [authLoading, returnTo, router, user]);

  if (authLoading || user) {
    return (
      <div className="flex h-full items-center justify-center bg-surface">
        <div className="bg-surface-elevated mx-4 flex max-w-md flex-col items-center rounded-2xl border border-border p-8 shadow-2xl">
          <div className="mb-4 text-center">
            <h1 className="text-2xl font-semibold text-foreground">
              Nextdoor Discovery
            </h1>
            <p className="mt-1 text-sm text-muted">
              Checking your session&hellip;
            </p>
          </div>
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-border/60 border-t-foreground" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full items-center justify-center bg-surface">
      <div className="bg-surface-elevated mx-4 w-full max-w-md rounded-2xl border border-border p-8 shadow-2xl">
        <div className="mb-8 text-center">
          <h1 className="mb-2 text-3xl font-bold text-foreground">
            Nextdoor Discovery
          </h1>
          <p className="text-white">
            Sign in to access the podcast discovery dashboard.
          </p>
        </div>

        {reason === "auth_error" && (
          <p className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800">
            Your session may have expired. Please sign in again.
          </p>
        )}

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
              "disabled:cursor-not-allowed disabled:opacity-60"
            )}
            disabled={isSubmitting}
            type="submit"
          >
            {isSubmitting ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-gray-500">
          Access is restricted to authorized users only.
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-full items-center justify-center bg-gradient-to-br from-gray-900 to-gray-800">
          <div className="bg-white/95 mx-4 flex max-w-md flex-col items-center rounded-2xl p-8 shadow-2xl">
            <div className="mb-4 text-center">
              <h1 className="text-2xl font-semibold text-gray-900">
                Nextdoor Discovery
              </h1>
              <p className="mt-1 text-sm text-gray-500">
                Loading sign-in experience&hellip;
              </p>
            </div>
            <div className="h-10 w-10 animate-spin rounded-full border-2 border-gray-300 border-t-gray-900" />
          </div>
        </div>
      }
    >
      <LoginContent />
    </Suspense>
  );
}
