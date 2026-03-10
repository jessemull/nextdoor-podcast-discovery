import { cookies, headers } from "next/headers";
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
    const headerList = await headers();
    const cookieList = await cookies();
    const sessionCookiePresent = cookieList
      .getAll()
      .some((c) => c.name.startsWith("__session"));
    console.error("[auth-session-missing]", {
      host: headerList.get("host"),
      referer: headerList.get("referer"),
      sessionCookiePresent,
      userAgent: headerList.get("user-agent"),
    });
    redirect("/auth/login?returnTo=/");
  }

  return <>{children}</>;
}
