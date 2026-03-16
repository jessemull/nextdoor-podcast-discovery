import "./globals.css";
import { Lora, Playfair_Display } from "next/font/google";
import { Providers } from "./providers";

import type { Metadata } from "next";

export const metadata: Metadata = {
  description: "Discover and curate interesting Nextdoor posts for your podcast",
  title: "Nextdoor Podcast Discovery",
};

const lora = Lora({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const playfair = Playfair_Display({
  subsets: ["latin"],
  weight: ["600", "700"],
});

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
