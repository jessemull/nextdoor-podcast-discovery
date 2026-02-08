"use client";

import { useQuery } from "@tanstack/react-query";
import { useSession } from "next-auth/react";

import type { SportsFactResponse } from "@/lib/types";

export function SportsFact() {
  const { data: session } = useSession();
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

  if (!isLoggedIn || isLoading) {
    return null;
  }

  if (isError && error) {
    return (
      <div className="mb-6 rounded-lg border border-amber-700 bg-amber-900/30 px-4 py-3 text-amber-200">
        <p className="font-bold">Pittsburgh Sports Fact</p>
        <p className="text-sm">{error.message}</p>
      </div>
    );
  }

  if (!data?.fact) {
    return null;
  }

  return (
    <div className="mb-6 rounded-lg bg-gradient-to-r from-yellow-500 to-yellow-600 px-4 py-3 text-black shadow-md">
      <div className="flex items-center gap-3">
        <span aria-label="Football" className="text-2xl" role="img">🏈</span>
        <div>
          <p className="font-bold">Pittsburgh Sports Fact!</p>
          <p className="text-sm">{data.fact}</p>
        </div>
      </div>
    </div>
  );
}
