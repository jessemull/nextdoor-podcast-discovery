import { PodcastSubscribeGrid } from "@/components/PodcastSubscribeGrid";
import { playfair } from "@/lib/fonts";

import type { Metadata } from "next";

export const metadata: Metadata = {
  description: "Subscribe to the podcast on your favorite platform.",
  title: "Subscribe | Podcast",
};

export default function SubscribePage() {
  return (
    <div className="mx-auto max-w-6xl px-5 py-10 sm:px-7 md:py-14">
      <h1
        className={`text-podcast-foreground mb-3 text-center text-4xl font-bold sm:text-5xl ${playfair.className}`}
      >
        Subscribe
      </h1>
      <p className="text-podcast-muted mx-auto mb-8 max-w-2xl text-center text-base sm:text-lg">
        Pick your favorite podcast app.
      </p>
      <PodcastSubscribeGrid />
    </div>
  );
}
