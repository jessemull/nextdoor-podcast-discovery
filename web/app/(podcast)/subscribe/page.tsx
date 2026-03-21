import type { Metadata } from "next";

export const metadata: Metadata = {
  description: "Subscribe to the podcast on your favorite platform.",
  title: "Subscribe | Podcast",
};

export default function SubscribePage() {
  return (
    <div className="mx-auto max-w-2xl px-5 py-12 sm:px-7">
      <h1 className="text-foreground mb-6 text-2xl font-bold">Subscribe</h1>
      <p className="text-muted mb-6">
        Subscribe on your favorite platform. Links to Apple Podcasts, Spotify,
        and the RSS feed can be added here once they are set up.
      </p>
      <p className="text-muted text-sm">
        RSS feed: <code className="rounded bg-surface-hover px-1 py-0.5">/feed.xml</code>
      </p>
    </div>
  );
}
