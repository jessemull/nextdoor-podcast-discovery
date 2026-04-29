import { lora } from "@/lib/fonts";

import "./globals.css";
import { Providers } from "./providers";

import type { Metadata } from "next";

export const metadata: Metadata = {
  description: "Discover and curate interesting Nextdoor posts for your podcast",
  icons: {
    icon: "/icon.svg",
  },
  openGraph: {
    description: "Discover and curate interesting Nextdoor posts for your podcast",
    images: [
      {
        alt: "Nextdoor Podcast Discovery",
        height: 630,
        url: "/og-image.png",
        width: 1200,
      },
    ],
    title: "Nextdoor Podcast Discovery",
    type: "website",
  },
  title: "Nextdoor Podcast Discovery",
  twitter: {
    card: "summary_large_image",
    description: "Discover and curate interesting Nextdoor posts for your podcast",
    images: ["/og-image.png"],
    title: "Nextdoor Podcast Discovery",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body
        className={`bg-background text-foreground antialiased ${lora.className}`}
      >
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
