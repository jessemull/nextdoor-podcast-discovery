import { redirect } from "next/navigation";

import { Navbar } from "@/components/Navbar";
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
    redirect("/login?returnTo=/dashboard");
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <Navbar />
      <div className="min-h-0 flex-1 overflow-hidden">{children}</div>
    </div>
  );
}
