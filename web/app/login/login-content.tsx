"use client";

import { useSearchParams } from "next/navigation";

import { LoginCredentialsForm } from "@/app/login/login-credentials-form";
import { LoginForgotForm } from "@/app/login/login-forgot-form";
import { LoginMfaForm } from "@/app/login/login-mfa-form";
import { getSafeReturnTo } from "@/app/login/login-utils";
import { useLoginFlow } from "@/app/login/use-login-flow.client";

export function LoginContent() {
  const searchParams = useSearchParams();
  const returnTo = getSafeReturnTo(searchParams.get("returnTo"));
  const reason = searchParams.get("reason");
  const flow = useLoginFlow(returnTo);

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

        {!flow.isInMfaFlow && searchParams.get("message") === "password_reset" && (
          <p className="mb-4 rounded-lg border border-green-200 bg-green-50 px-4 py-2 text-sm text-green-800">
            Your password has been updated. Sign in with your new password.
          </p>
        )}

        {!flow.isInMfaFlow && reason === "auth_error" && (
          <p className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800">
            Your session may have expired. Please sign in again.
          </p>
        )}

        {!flow.isInMfaFlow && reason === "recovery_link_invalid" && (
          <p className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800">
            This password reset link is invalid or has expired. Request a new
            reset from the sign-in page.
          </p>
        )}

        {!flow.isInMfaFlow && flow.showForgotPassword ? (
          <LoginForgotForm
            email={flow.email}
            forgotError={flow.forgotError}
            forgotSubmitting={flow.forgotSubmitting}
            forgotSuccess={flow.forgotSuccess}
            setEmail={flow.setEmail}
            onBack={flow.exitForgotPassword}
            onSubmit={flow.handleForgotSubmit}
          />
        ) : !flow.isInMfaFlow ? (
          <LoginCredentialsForm
            email={flow.email}
            error={flow.error}
            isSubmitting={flow.isSubmitting}
            password={flow.password}
            setEmail={flow.setEmail}
            setPassword={flow.setPassword}
            setShowPassword={flow.setShowPassword}
            showPassword={flow.showPassword}
            onForgotClick={() => flow.setShowForgotPassword(true)}
            onSubmit={flow.handleSubmit}
          />
        ) : null}

        {flow.isInMfaFlow && (
          <LoginMfaForm
            handleResetMfaAndShowQr={flow.handleResetMfaAndShowQr}
            handleVerifyMfa={flow.handleVerifyMfa}
            isSubmitting={flow.isSubmitting}
            mfaCode={flow.mfaCode}
            mfaError={flow.mfaError}
            mfaMode={flow.mfaMode as "enroll" | "verify"}
            mfaQrCode={flow.mfaQrCode}
            mfaSecret={flow.mfaSecret}
            setMfaCode={flow.setMfaCode}
            onBack={flow.exitMfa}
          />
        )}

        {!flow.isInMfaFlow && (
          <p className="mt-6 text-center text-sm text-gray-500">
            Access is restricted to authorized users only.
          </p>
        )}
      </div>
    </div>
  );
}
