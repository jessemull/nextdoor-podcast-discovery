import { Suspense, type ReactNode } from "react";

import { GoogleAnalytics } from "@/components/GoogleAnalytics";
import { PodcastFooter } from "@/components/PodcastFooter";
import { PodcastHeader } from "@/components/PodcastHeader";
import { PodcastSearchProvider } from "@/components/PodcastSearchProvider";
import { ScrollToTop } from "@/components/ScrollToTop";

interface PodcastLayoutProps {
  children: ReactNode;
}

export default function PodcastLayout({ children }: PodcastLayoutProps) {
  return (
    <div className="podcast-site flex h-dvh flex-col overflow-hidden">
      <GoogleAnalytics />
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <Suspense
          fallback={
            <main className="podcast-main-scroll flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-y-contain">
              <header className="w-full shrink-0 py-4" />
              <div className="flex min-h-0 flex-1 flex-col">
                <div className="min-h-0 flex-1" />
              </div>
            </main>
          }
        >
          <PodcastSearchProvider>
            <main className="podcast-main-scroll flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-y-contain">
              <PodcastHeader />
              <div className="flex min-h-0 flex-1 flex-col">
                <div className="min-h-0 flex-1">{children}</div>
                <PodcastFooter />
              </div>
            </main>
          </PodcastSearchProvider>
        </Suspense>
      </div>
      <ScrollToTop />
    </div>
  );
}
