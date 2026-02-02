"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SessionProvider } from "next-auth/react";
import { useState } from "react";

import { ErrorBoundary } from "@/components/ErrorBoundary";

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            refetchOnWindowFocus: false,
            staleTime: 60 * 1000, // 1 minute
          },
        },
      })
  );

  return (
    <ErrorBoundary>
      <SessionProvider>
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      </SessionProvider>
    </ErrorBoundary>
  );
}
