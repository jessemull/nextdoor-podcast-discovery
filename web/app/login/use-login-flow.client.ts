"use client";

import { type FormEvent, useCallback, useState } from "react";

import { isInvalidRefreshTokenError } from "@/lib/auth-errors";
import { getSupabase } from "@/lib/supabase.client";

import {
  getTotpFactorsFromListFactorsResponse,
  isMfaFactorNameConflict,
} from "./login-utils";

export interface UseLoginFlowResult {
  email: string;
  error: string | null;
  exitForgotPassword: () => void;
  exitMfa: () => void;
  forgotError: string | null;
  forgotSubmitting: boolean;
  forgotSuccess: boolean;
  handleForgotSubmit: (e: FormEvent) => Promise<void>;
  handleResetMfaAndShowQr: () => Promise<void>;
  handleSubmit: (e: FormEvent) => Promise<void>;
  handleVerifyMfa: (e: FormEvent) => Promise<void>;
  isInMfaFlow: boolean;
  isSubmitting: boolean;
  mfaCode: string;
  mfaError: string | null;
  mfaMode: "enroll" | "none" | "verify";
  mfaQrCode: string | null;
  mfaSecret: string | null;
  password: string;
  setEmail: (v: string) => void;
  setMfaCode: (v: string) => void;
  setPassword: (v: string) => void;
  setShowForgotPassword: (v: boolean) => void;
  setShowPassword: (v: boolean | ((p: boolean) => boolean)) => void;
  showForgotPassword: boolean;
  showPassword: boolean;
}

export function useLoginFlow(returnTo: string): UseLoginFlowResult {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [mfaError, setMfaError] = useState<string | null>(null);
  const [mfaCode, setMfaCode] = useState("");
  const [mfaMode, setMfaMode] = useState<"enroll" | "none" | "verify">("none");
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
    async (e: FormEvent) => {
      e.preventDefault();
      setForgotError(null);
      setForgotSubmitting(true);
      try {
        const supabase = getSupabase();
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
    async (e: FormEvent) => {
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

        const { data: factorsData, error: factorsError } = await (
          supabase.auth as any
        ).mfa.listFactors();
        if (factorsError) {
          throw factorsError;
        }

        const totpFactors = getTotpFactorsFromListFactorsResponse(factorsData);
        const hasVerifiedTotp = totpFactors.some((f) => f.status === "verified");

        if (!totpFactors || totpFactors.length === 0) {
          const { data: enrollData, error: enrollError } = await (
            supabase.auth as any
          ).mfa.enroll({
            factorType: "totp",
          });
          if (enrollError) {
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
                const { data: retryEnrollData, error: retryEnrollErr } = await (
                  supabase.auth as any
                ).mfa.enroll({
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

          const { data: challengeData, error: challengeError } = await (
            supabase.auth as any
          ).mfa.challenge({
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
          const existingFactorId = totpFactors[0].id;
          const { error: unenrollErr } = await (supabase.auth as any).mfa.unenroll({
            factorId: existingFactorId,
          });
          if (unenrollErr) {
            throw unenrollErr;
          }
          const { data: enrollData, error: enrollError } = await (
            supabase.auth as any
          ).mfa.enroll({
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
          const { data: challengeData, error: challengeError } = await (
            supabase.auth as any
          ).mfa.challenge({
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

        const factorId = totpFactors[0].id;
        const { data: challengeData, error: challengeError } = await (
          supabase.auth as any
        ).mfa.challenge({
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

              const { data: retryEnrollData, error: retryEnrollErr } = await (
                supabase.auth as any
              ).mfa.enroll({
                factorType: "totp",
              });
              if (retryEnrollErr) throw retryEnrollErr;

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
              if (retryChallengeError) throw retryChallengeError;
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
    async (e: FormEvent) => {
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

        await supabase.auth.getSession();
        await new Promise((r) => setTimeout(r, 200));
        window.location.href = returnTo;
      } catch (err) {
        if (isInvalidRefreshTokenError(err)) {
          await getSupabase().auth.signOut();
          setMfaError("Session could not be established. Please sign in again.");
        } else {
          console.error("[login] MFA verify error", err);
          setMfaError("Invalid code. Please double-check and try again.");
        }
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

      const { data: factorsData, error: factorsError } = await (
        supabase.auth as any
      ).mfa.listFactors();
      if (factorsError) {
        throw factorsError;
      }

      const totpFactors = getTotpFactorsFromListFactorsResponse(factorsData);

      if (totpFactors.length > 0) {
        setMfaError("Could not remove previous setup. Please try again or contact support.");
        setIsSubmitting(false);
        return;
      }

      const { data: enrollData, error: enrollError } = await (
        supabase.auth as any
      ).mfa.enroll({
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

      const { data: challengeData, error: challengeError } = await (
        supabase.auth as any
      ).mfa.challenge({
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

  const exitForgotPassword = useCallback(() => {
    setShowForgotPassword(false);
    setForgotError(null);
    setForgotSuccess(false);
  }, []);

  const exitMfa = useCallback(() => {
    setMfaMode("none");
    setMfaCode("");
    setMfaError(null);
  }, []);

  const isInMfaFlow = mfaMode !== "none";

  return {
    email,
    error,
    exitForgotPassword,
    exitMfa,
    forgotError,
    forgotSubmitting,
    forgotSuccess,
    handleForgotSubmit,
    handleResetMfaAndShowQr,
    handleSubmit,
    handleVerifyMfa,
    isInMfaFlow,
    isSubmitting,
    mfaCode,
    mfaError,
    mfaMode,
    mfaQrCode,
    mfaSecret,
    password,
    setEmail,
    setMfaCode,
    setPassword,
    setShowForgotPassword,
    setShowPassword,
    showForgotPassword,
    showPassword,
  };
}
