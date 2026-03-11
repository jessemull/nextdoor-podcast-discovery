"use client";

import { useCallback, useEffect, useState } from "react";

import { getSupabase } from "@/lib/supabase.client";

interface TotpFactor {
  id: string;
  // Supabase may expose additional fields; we only care about id + type here.
  factorType?: string;
}

interface PendingEnrollment {
  challengeId: string;
  factorId: string;
  qrCode?: string;
  secret?: string;
}

interface UseMfaResult {
  enrolledTotp: TotpFactor | null;
  enrollError: string | null;
  isBusy: boolean;
  isEnrolling: boolean;
  isLoading: boolean;
  pendingEnrollment: PendingEnrollment | null;
  refreshFactors: () => Promise<void>;
  startTotpEnrollment: () => Promise<void>;
  verifyTotpEnrollment: (code: string) => Promise<void>;
  disableTotp: () => Promise<void>;
}

export function useMfa(): UseMfaResult {
  const [isLoading, setIsLoading] = useState(true);
  const [isBusy, setIsBusy] = useState(false);
  const [isEnrolling, setIsEnrolling] = useState(false);
  const [enrolledTotp, setEnrolledTotp] = useState<TotpFactor | null>(null);
  const [pendingEnrollment, setPendingEnrollment] = useState<PendingEnrollment | null>(null);
  const [enrollError, setEnrollError] = useState<string | null>(null);

  const refreshFactors = useCallback(async () => {
    setIsLoading(true);
    setEnrollError(null);
    try {
      const supabase = getSupabase();
      // Supabase returns factors in data.all with factor_type (e.g. "totp"), not data.totp.
      const { data, error } = await (supabase.auth as any).mfa.listFactors();
      if (error) {
        throw error;
      }

      const all = (data as { all?: { id: string; factor_type?: string }[] })?.all ?? [];
      const totpFactors: TotpFactor[] = all
        .filter((f) => f.factor_type === "totp")
        .map((f) => ({ factorType: "totp", id: f.id }));

      setEnrolledTotp(totpFactors[0] ?? null);
    } catch (error) {
      console.error("[useMfa] listFactors error", error);
      setEnrollError(
        error instanceof Error ? error.message : "Failed to load multi-factor status."
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  const startTotpEnrollment = useCallback(async () => {
    setIsBusy(true);
    setIsEnrolling(true);
    setEnrollError(null);
    setPendingEnrollment(null);

    try {
      const supabase = getSupabase();
      // 1) Enroll a new TOTP factor to get QR/secret + factorId.
      const { data: enrollData, error: enrollError } = await (supabase.auth as any).mfa.enroll(
        {
          factorType: "totp",
        }
      );

      if (enrollError) {
        throw enrollError;
      }

      const factorId: string | undefined = enrollData?.id;
      const qrCode: string | undefined = enrollData?.totp?.qr_code;
      const secret: string | undefined = enrollData?.totp?.secret;

      if (!factorId) {
        throw new Error("Missing factor id from enrollment response.");
      }

      // 2) Start a challenge for this factor so verify() has a challengeId.
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

      setPendingEnrollment({
        challengeId,
        factorId,
        qrCode,
        secret,
      });
    } catch (error) {
      console.error("[useMfa] enroll error", error);
      setEnrollError(
        error instanceof Error
          ? error.message
          : "Failed to start two-factor enrollment. Please try again."
      );
      setPendingEnrollment(null);
    } finally {
      setIsBusy(false);
      setIsEnrolling(false);
    }
  }, []);

  const verifyTotpEnrollment = useCallback(
    async (code: string) => {
      if (!pendingEnrollment) {
        return;
      }

      setIsBusy(true);
      setEnrollError(null);

      try {
        const supabase = getSupabase();
        const { error } = await (supabase.auth as any).mfa.verify({
          factorId: pendingEnrollment.factorId,
          challengeId: pendingEnrollment.challengeId,
          code,
        });

        if (error) {
          throw error;
        }

        setPendingEnrollment(null);
        await refreshFactors();
      } catch (error) {
        console.error("[useMfa] verify error", error);
        setEnrollError(
          error instanceof Error
            ? error.message
            : "Invalid code. Please double-check and try again."
        );
      } finally {
        setIsBusy(false);
      }
    },
    [pendingEnrollment, refreshFactors]
  );

  const disableTotp = useCallback(async () => {
    if (!enrolledTotp) {
      return;
    }

    setIsBusy(true);
    setEnrollError(null);

    try {
      const supabase = getSupabase();
      const { error } = await (supabase.auth as any).mfa.unenroll({
        factorId: enrolledTotp.id,
      });
      if (error) {
        throw error;
      }

      await refreshFactors();
    } catch (error) {
      console.error("[useMfa] disable error", error);
      setEnrollError(
        error instanceof Error
          ? error.message
          : "Failed to disable two-factor authentication."
      );
    } finally {
      setIsBusy(false);
    }
  }, [enrolledTotp, refreshFactors]);

  useEffect(() => {
    void refreshFactors();
  }, [refreshFactors]);

  return {
    enrolledTotp,
    enrollError,
    isBusy,
    isEnrolling,
    isLoading,
    pendingEnrollment,
    refreshFactors,
    startTotpEnrollment,
    verifyTotpEnrollment,
    disableTotp,
  };
}

