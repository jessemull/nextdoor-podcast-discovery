"use client";

import { useSession } from "next-auth/react";
import { useQuery } from "@tanstack/react-query";

import type { SportsFactResponse } from "@/lib/types";

const MATT_EMAIL = process.env.NEXT_PUBLIC_MATT_EMAIL;

export function SportsFact() {
  const { data: session } = useSession();

  const isMatt = session?.user?.email === MATT_EMAIL;

  const { data, isLoading } = useQuery<SportsFactResponse>({
    queryKey: ["sports-fact"],
    queryFn: async () => {
      const res = await fetch("/api/sports-fact");
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
    enabled: isMatt,
    staleTime: Infinity,
  });

  if (!isMatt || isLoading || !data?.fact) {
    return null;
  }

  return (
    <div className="bg-gradient-to-r from-yellow-500 to-yellow-600 text-black px-4 py-3 rounded-lg mb-6 shadow-md">
      <div className="flex items-center gap-3">
        <span className="text-2xl">🏈</span>
        <div>
          <p className="font-bold">Hey Matt!</p>
          <p className="text-sm">{data.fact}</p>
        </div>
      </div>
    </div>
  );
}
