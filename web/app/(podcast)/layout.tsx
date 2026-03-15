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
    <div className="podcast-site flex min-h-screen flex-col overflow-y-auto">
      <GoogleAnalytics />
      <Suspense fallback={<header className="w-full py-4" />}>
        <PodcastHeader />
      </Suspense>
      <main className="min-h-0 flex-1">{children}</main>
      <PodcastFooter />
      <ScrollToTop />
    </div>
  );
}
