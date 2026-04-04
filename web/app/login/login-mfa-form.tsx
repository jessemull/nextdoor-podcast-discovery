"use client";

import { Spinner } from "@/components/ui/Spinner";
import { cn } from "@/lib/utils";

import type { FormEvent } from "react";

export interface LoginMfaFormProps {
  handleResetMfaAndShowQr: () => void | Promise<void>;
  handleVerifyMfa: (e: FormEvent) => void | Promise<void>;
  isSubmitting: boolean;
  mfaCode: string;
  mfaError: string | null;
  mfaMode: "enroll" | "verify";
  mfaQrCode: string | null;
  mfaSecret: string | null;
  onBack: () => void;
  setMfaCode: (v: string) => void;
}

export function LoginMfaForm({
  handleResetMfaAndShowQr,
  handleVerifyMfa,
  isSubmitting,
  mfaCode,
  mfaError,
  mfaMode,
  mfaQrCode,
  mfaSecret,
  onBack,
  setMfaCode,
}: LoginMfaFormProps) {
  return (
    <form onSubmit={handleVerifyMfa}>
      <div className="mb-4">
        <h2 className="mb-1 text-lg font-semibold text-foreground">
          {mfaMode === "enroll"
            ? "Set up two-factor authentication"
            : "Two-factor authentication"}
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
                  __html: decodeURIComponent(mfaQrCode.split(",")[1] ?? ""),
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
          onClick={onBack}
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
  );
}
