import { Navbar } from "@/components/Navbar";

import "./globals.css";
import { Providers } from "./providers";

import type { Metadata } from "next";

export const metadata: Metadata = {
  description: "Discover and curate interesting Nextdoor posts for your podcast",
  title: "Nextdoor Podcast Discovery",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-background text-foreground antialiased">
        <Providers>
          <div className="flex h-screen flex-col overflow-hidden">
            <Navbar />
            <div className="min-h-0 flex-1 overflow-hidden">
              {children}
            </div>
          </div>
        </Providers>
      </body>
    </html>
  );
}
