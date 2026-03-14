import { GoogleAnalytics } from "@/components/GoogleAnalytics";
import { PodcastFooter } from "@/components/PodcastFooter";
import { PodcastHeader } from "@/components/PodcastHeader";

import type { ReactNode } from "react";

interface PodcastLayoutProps {
  children: ReactNode;
}

export default function PodcastLayout({ children }: PodcastLayoutProps) {
  return (
    <div className="flex min-h-screen flex-col">
      <GoogleAnalytics />
      <PodcastHeader />
      <main className="min-h-0 flex-1">{children}</main>
      <PodcastFooter />
    </div>
  );
}
