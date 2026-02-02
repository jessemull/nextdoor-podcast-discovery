"use client";

import { useQuery } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { useMemo } from "react";

import { clientEnv } from "@/lib/env.client";

import type { SportsFactResponse } from "@/lib/types";

export function SportsFact() {
  const { data: session } = useSession();

  // Memoize to avoid re-evaluating getter on every render

  const userEmail = useMemo(() => clientEnv.USER_EMAIL, []);
  const isSpecialUser = session?.user?.email === userEmail;

  const { data, isLoading } = useQuery<SportsFactResponse>({
    enabled: isSpecialUser,
    queryFn: async () => {
      const res = await fetch("/api/sports-fact");
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
    queryKey: ["sports-fact"],
    staleTime: Infinity,
  });

  if (!isSpecialUser || isLoading || !data?.fact) {
    return null;
  }

  return (
    <div className="bg-gradient-to-r from-yellow-500 to-yellow-600 text-black px-4 py-3 rounded-lg mb-6 shadow-md">
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
