import { redirect } from "next/navigation";

import { getSession } from "@/lib/supabase-server-auth";

import type { ReactNode } from "react";

interface ProtectedLayoutProps {
  children: ReactNode;
}

export default async function ProtectedLayout({
  children,
}: ProtectedLayoutProps) {
  const session = await getSession();
  if (!session) {
    redirect("/login?returnTo=/");
  }

  return <>{children}</>;
}
