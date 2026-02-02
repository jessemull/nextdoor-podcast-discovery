"use client";

import { signIn, useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { GoogleIcon } from "@/components/icons/GoogleIcon";
import { cn } from "@/lib/utils";

export default function LoginPage() {
  const { status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === "authenticated") {
      router.push("/");
    }
  }, [status, router]);

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 to-gray-800">
        <div className="animate-pulse text-gray-400">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 to-gray-800">
      <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full mx-4">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Nextdoor Discovery
          </h1>
          <p className="text-gray-600">
            Sign in to access the podcast discovery dashboard
          </p>
        </div>

        <button
          aria-label="Sign in with your Google account"
          className={cn(
            "w-full flex items-center justify-center gap-3",
            "bg-white border-2 border-gray-200 rounded-lg px-6 py-3",
            "text-gray-700 font-medium",
            "hover:bg-gray-50 hover:border-gray-300",
            "transition-all duration-200"
          )}
          onClick={() => signIn("google", { callbackUrl: "/" })}
        >
          <GoogleIcon />
          Sign in with Google
        </button>

        <p className="text-center text-sm text-gray-500 mt-6">
          Access is restricted to authorized users only.
        </p>
      </div>
    </div>
  );
}
