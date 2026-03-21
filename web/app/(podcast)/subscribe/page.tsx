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
        className={`text-podcast-foreground mb-4 text-center text-2xl font-semibold sm:text-3xl ${playfair.className}`}
      >
        Subscribe
      </h1>
      <p className="text-podcast-muted mx-auto mb-6 max-w-2xl text-center text-base">
        Pick your favorite podcast app.
      </p>
      <div className="mb-8">
        <PodcastSubscribeGrid />
      </div>

      <section className="mx-auto mb-8 w-full max-w-5xl px-1 sm:px-2">
        <h2 className={`text-podcast-foreground mb-4 text-center text-2xl font-semibold sm:text-3xl ${playfair.className}`}>
          Join Our Email List
        </h2>
        <p className="text-podcast-muted mb-5 text-center text-base">
          Get new episodes delivered to your inbox every Friday.
        </p>
        <form className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_0.6fr] lg:gap-3">
            <label className="sr-only" htmlFor="subscribe-first-name">
              First name
            </label>
              <input
                className="w-full border-0 bg-white px-3 py-3 text-black placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-podcast-accent"
                id="subscribe-first-name"
                name="firstName"
                placeholder="First name"
                type="text"
              />
            <label className="sr-only" htmlFor="subscribe-last-name">
              Last name
            </label>
              <input
                className="w-full border-0 bg-white px-3 py-3 text-black placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-podcast-accent"
                id="subscribe-last-name"
                name="lastName"
                placeholder="Last name"
                type="text"
              />
            <label className="sr-only" htmlFor="subscribe-email">
              Email
            </label>
              <input
                className="w-full border-0 bg-white px-3 py-3 text-black placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-podcast-accent"
                id="subscribe-email"
                name="email"
                placeholder="Email address"
                type="email"
              />
          <button
            className="inline-flex w-full items-center justify-center bg-podcast-accent px-8 py-3 text-base font-semibold text-black transition-opacity hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-podcast-accent"
            type="button"
          >
            Subscribe
          </button>
        </form>
      </section>
    </div>
  );
}
