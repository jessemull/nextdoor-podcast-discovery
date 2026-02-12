"use client";

import { useQuery } from "@tanstack/react-query";
import { useSession } from "next-auth/react";

import type { SportsFactResponse } from "@/lib/types";

const SPORTS_FACT_BODY_MIN_H = "min-h-[4.5rem]";

export function SportsFact() {
  const { data: session, status: sessionStatus } = useSession();
  const isLoggedIn = !!session?.user;

  const { data, error, isError, isLoading } = useQuery<SportsFactResponse>({
    enabled: isLoggedIn,
    queryFn: async () => {
      const res = await fetch("/api/sports-fact");
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(
          (body as { error?: string }).error ?? "Failed to load sports fact"
        );
      }
      return res.json();
    },
    queryKey: ["sports-fact"],
    staleTime: Infinity,
  });

  const showSkeleton =
    sessionStatus === "loading" ||
    (isLoggedIn && (isLoading || (!data?.fact && !error)));

  if (sessionStatus === "unauthenticated") {
    return null;
  }

  const wrapperClass =
    "border-pittsburgh-gold-muted mb-8 w-fit mx-auto rounded-lg border p-5 text-center";

  if (showSkeleton) {
    return (
      <div className={wrapperClass}>
        <div className="mb-5 h-7 w-48 animate-pulse rounded bg-surface-hover mx-auto" />
        <div className={SPORTS_FACT_BODY_MIN_H + " space-y-2"}>
          <div className="mx-auto h-4 max-w-md rounded bg-surface-hover animate-pulse" />
          <div className="mx-auto h-4 max-w-sm rounded bg-surface-hover animate-pulse" />
          <div className="mx-auto h-4 max-w-xs rounded bg-surface-hover animate-pulse" />
        </div>
      </div>
    );
  }

  if (isError && error) {
    return (
      <div className={wrapperClass}>
        <h2 className="mb-5 text-center text-2xl font-bold tracking-tight text-pittsburgh-gold-muted">
          Pittsburgh Sports Fact
        </h2>
        <p className="text-muted mx-auto max-w-xl text-base">{error.message}</p>
      </div>
    );
  }

  if (!data?.fact) {
    return null;
  }

  return (
    <div className={wrapperClass}>
      <h2 className="mb-5 text-center text-2xl font-bold tracking-tight text-pittsburgh-gold-muted">
        Pittsburgh Sports Fact
      </h2>
      <p
        className={
          SPORTS_FACT_BODY_MIN_H + " text-muted mx-auto max-w-xl text-base"
        }
      >
        {data.fact}
      </p>
    </div>
  );
}
