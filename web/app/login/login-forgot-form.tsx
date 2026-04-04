"use client";

import { Spinner } from "@/components/ui/Spinner";
import { cn } from "@/lib/utils";

import type { FormEvent } from "react";

export interface LoginForgotFormProps {
  email: string;
  forgotError: string | null;
  forgotSubmitting: boolean;
  forgotSuccess: boolean;
  onBack: () => void;
  onSubmit: (e: FormEvent) => void | Promise<void>;
  setEmail: (v: string) => void;
}

export function LoginForgotForm({
  email,
  forgotError,
  forgotSubmitting,
  forgotSuccess,
  onBack,
  onSubmit,
  setEmail,
}: LoginForgotFormProps) {
  return (
    <form onSubmit={onSubmit}>
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
        <>
          <p className="mb-4 rounded-lg border border-green-200 bg-green-50 px-4 py-2 text-sm text-green-800">
            If an account exists, we&apos;ve sent a reset link to that email.
          </p>
          <p className="text-muted mb-4 text-xs">
            When you open the link, expand &quot;Debug (reset flow)&quot; on the reset
            page to see cookies and any error.
          </p>
        </>
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
          onClick={onBack}
        >
          Back To Sign In
        </button>
      </p>
    </form>
  );
}
