"use client";

import { Eye, EyeOff } from "lucide-react";

import { Spinner } from "@/components/ui/Spinner";
import { cn } from "@/lib/utils";

import type { FormEvent } from "react";

export interface LoginCredentialsFormProps {
  email: string;
  error: string | null;
  isSubmitting: boolean;
  onForgotClick: () => void;
  onSubmit: (e: FormEvent) => void | Promise<void>;
  password: string;
  setEmail: (v: string) => void;
  setPassword: (v: string) => void;
  setShowPassword: (v: boolean | ((p: boolean) => boolean)) => void;
  showPassword: boolean;
}

export function LoginCredentialsForm({
  email,
  error,
  isSubmitting,
  onForgotClick,
  onSubmit,
  password,
  setEmail,
  setPassword,
  setShowPassword,
  showPassword,
}: LoginCredentialsFormProps) {
  return (
    <form onSubmit={onSubmit}>
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
          onClick={onForgotClick}
        >
          Forgot Password?
        </button>
      </p>
    </form>
  );
}
