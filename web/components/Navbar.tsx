"use client";

import { useSession, signOut } from "next-auth/react";
import Link from "next/link";

import { cn } from "@/lib/utils";

const navLinkClass = cn(
  "text-gray-400 hover:text-white transition-colors"
);

export function Navbar() {
  const { data: session, status } = useSession();

  return (
    <nav className="bg-gray-900 border-b border-gray-800">
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
        <Link href="/" className="text-xl font-bold" aria-label="Go to home page">
          🎙️ Podcast Discovery
        </Link>

        <div className="flex items-center gap-4">
          {/* TODO: Implement /search page - see GitHub issue #X */}
          <Link href="/search" className={navLinkClass}>
            Search
          </Link>
          {/* TODO: Implement /settings page - see GitHub issue #X */}
          <Link href="/settings" className={navLinkClass}>
            Settings
          </Link>

          {status === "loading" ? (
            <span className="text-gray-500">Loading...</span>
          ) : session ? (
            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-400">{session.user?.email}</span>
              <button
                onClick={() => signOut()}
                aria-label="Sign out of your account"
                className={cn(
                  "px-3 py-1 text-sm rounded-md transition-colors",
                  "bg-gray-800 hover:bg-gray-700"
                )}
              >
                Sign Out
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </nav>
  );
}
