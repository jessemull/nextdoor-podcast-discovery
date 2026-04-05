import { Suspense } from "react";

import { LoginContent } from "@/app/login/login-content";

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-surface">
          <div className="flex flex-col items-center gap-3">
            <div className="h-10 w-10 animate-spin rounded-full border-2 border-border/30 border-t-white" />
            <p className="text-sm text-muted">
              Loading sign-in experience&hellip;
            </p>
          </div>
        </div>
      }
    >
      <LoginContent />
    </Suspense>
  );
}
