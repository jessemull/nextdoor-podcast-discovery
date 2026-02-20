"use client";

import { useUser } from "@auth0/nextjs-auth0/client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { cn } from "@/lib/utils";

export default function LoginPage() {
  const { isLoading, user } = useUser();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && user) {
      router.push("/");
    }
  }, [isLoading, user, router]);

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center bg-gradient-to-br from-gray-900 to-gray-800">
        <div className="animate-pulse text-gray-400">Loading...</div>
      </div>
    );
  }

  if (user) {
    return null;
  }

  return (
    <div className="flex h-full items-center justify-center bg-gradient-to-br from-gray-900 to-gray-800">
      <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full mx-4">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Nextdoor Discovery
          </h1>
          <p className="text-gray-600">
            Sign in to access the podcast discovery dashboard
          </p>
        </div>

        <Link
          aria-label="Sign in with Auth0"
          className={cn(
            "block w-full text-center",
            "bg-white border-2 border-gray-200 rounded-lg px-6 py-3",
            "text-gray-700 font-medium",
            "hover:bg-gray-50 hover:border-gray-300",
            "transition-all duration-200"
          )}
          href="/auth/login"
        >
          Sign in with Auth0
        </Link>

        <p className="text-center text-sm text-gray-500 mt-6">
          Access is restricted to authorized users only.
        </p>
      </div>
    </div>
  );
}
