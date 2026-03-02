import { redirect } from "next/navigation";

import { auth0 } from "@/lib/auth0";

import type { ReactNode } from "react";

interface ProtectedLayoutProps {
  children: ReactNode;
}

export default async function ProtectedLayout({
  children,
}: ProtectedLayoutProps) {
  const session = await auth0.getSession();
  if (!session) {
    redirect("/auth/login?returnTo=/");
  }

  return <>{children}</>;
}
