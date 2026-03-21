import { Suspense, type ReactNode } from "react";

import { GoogleAnalytics } from "@/components/GoogleAnalytics";
import { PodcastFooter } from "@/components/PodcastFooter";
import { PodcastHeader } from "@/components/PodcastHeader";
import { ScrollToTop } from "@/components/ScrollToTop";

interface PodcastLayoutProps {
  children: ReactNode;
}

export default function PodcastLayout({ children }: PodcastLayoutProps) {
  return (
    <div className="podcast-site flex h-dvh flex-col overflow-y-auto overscroll-y-contain">
      <GoogleAnalytics />
      <Suspense fallback={<header className="w-full shrink-0 py-4" />}>
        <PodcastHeader />
      </Suspense>
      <main className="shrink-0">{children}</main>
      <PodcastFooter />
      <ScrollToTop />
    </div>
  );
}
