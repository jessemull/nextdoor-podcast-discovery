"use client";

import { useSession, signIn, signOut } from "next-auth/react";
import Link from "next/link";

export function Navbar() {
  const { data: session, status } = useSession();

  return (
    <nav className="bg-gray-900 border-b border-gray-800">
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
        <Link href="/" className="text-xl font-bold">
          🎙️ Podcast Discovery
        </Link>

        <div className="flex items-center gap-4">
          <Link
            href="/search"
            className="text-gray-400 hover:text-white transition-colors"
          >
            Search
          </Link>
          <Link
            href="/settings"
            className="text-gray-400 hover:text-white transition-colors"
          >
            Settings
          </Link>

          {status === "loading" ? (
            <span className="text-gray-500">Loading...</span>
          ) : session ? (
            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-400">{session.user?.email}</span>
              <button
                onClick={() => signOut()}
                className="px-3 py-1 text-sm bg-gray-800 hover:bg-gray-700 rounded-md transition-colors"
              >
                Sign Out
              </button>
            </div>
          ) : (
            <button
              onClick={() => signIn("google")}
              className="px-3 py-1 text-sm bg-blue-600 hover:bg-blue-500 rounded-md transition-colors"
            >
              Sign In
            </button>
          )}
        </div>
      </div>
    </nav>
  );
}
