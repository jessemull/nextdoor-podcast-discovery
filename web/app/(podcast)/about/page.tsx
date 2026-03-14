import type { Metadata } from "next";

export const metadata: Metadata = {
  description: "About the podcast.",
  title: "About | Podcast",
};

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6">
      <h1 className="text-foreground mb-6 text-2xl font-bold">About</h1>
      <div className="text-foreground space-y-4 text-base">
        <p className="text-muted">
          Learn more about the show, the hosts, and what we do. This page can
          be updated with your podcast description and team info.
        </p>
      </div>
    </div>
  );
}
