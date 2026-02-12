"use client";

import { useQuery } from "@tanstack/react-query";
import { Info } from "lucide-react";
import { useSession } from "next-auth/react";

import { Card } from "@/components/ui/Card";

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
      <Card className="mb-6 border-border-focus">
        <p className="font-semibold text-foreground">
          Pittsburgh Sports Fact
        </p>
        <p className="text-muted text-sm">{error.message}</p>
      </Card>
    );
  }

  if (!data?.fact) {
    return null;
  }

  return (
    <Card className="mb-6">
      <div className="flex items-center gap-3">
        <Info
          aria-hidden
          className="h-5 w-5 shrink-0 text-muted"
        />
        <div>
          <p className="font-semibold text-foreground">
            Pittsburgh Sports Fact
          </p>
          <p className="text-muted text-sm">{data.fact}</p>
        </div>
      </div>
    </Card>
  );
}
