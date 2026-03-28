import { PodcastSubscribeGrid } from "@/components/PodcastSubscribeGrid";
import { playfair } from "@/lib/fonts";

import type { Metadata } from "next";

export const metadata: Metadata = {
  description: "Subscribe to the podcast on your favorite platform.",
  title: "Subscribe | Podcast",
};

const subscribeInputClassName =
  "w-full rounded-[5px] border border-podcast-accent bg-transparent px-3 py-3 text-podcast-foreground shadow-none transition-shadow duration-200 placeholder:text-podcast-muted focus:outline-none focus:shadow-[0_0_0_3px_rgba(238,207,62,0.45),0_0_28px_rgba(238,207,62,0.4)]";

export default function SubscribePage() {
  return (
    <div className="mx-auto max-w-6xl px-5 py-10 sm:px-7 md:py-14">
      <section className="mx-auto mb-14 w-full max-w-5xl px-1 sm:px-2">
        <h2 className={`text-podcast-foreground mb-4 text-center text-2xl font-semibold sm:text-3xl ${playfair.className}`}>
          Join Our Email List
        </h2>
        <p className="text-podcast-muted mb-8 text-center text-base">
          Get new episodes delivered to your inbox every Friday.
        </p>
        <form className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_0.6fr] lg:gap-3">
          <label className="sr-only" htmlFor="subscribe-first-name">
            First name
          </label>
          <input
            className={subscribeInputClassName}
            id="subscribe-first-name"
            name="firstName"
            placeholder="First name"
            type="text"
          />
          <label className="sr-only" htmlFor="subscribe-last-name">
            Last name
          </label>
          <input
            className={subscribeInputClassName}
            id="subscribe-last-name"
            name="lastName"
            placeholder="Last name"
            type="text"
          />
          <label className="sr-only" htmlFor="subscribe-email">
            Email
          </label>
          <input
            className={`${subscribeInputClassName} sm:col-span-2 lg:col-span-1`}
            id="subscribe-email"
            name="email"
            placeholder="Email address"
            type="email"
          />
          <button
            className="inline-flex w-full items-center justify-center rounded-[5px] bg-podcast-accent px-8 py-3 text-base font-semibold text-black transition-opacity hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-podcast-accent sm:col-span-2 lg:col-span-1"
            type="button"
          >
            Subscribe
          </button>
        </form>
      </section>

      <h1
        className={`text-podcast-foreground mb-4 text-center text-2xl font-semibold sm:text-3xl ${playfair.className}`}
      >
        Subscribe
      </h1>
      <p className="text-podcast-muted mx-auto mb-9 max-w-2xl text-center text-base">
        Pick your favorite podcast app.
      </p>
      <div className="mb-12">
        <PodcastSubscribeGrid />
      </div>
    </div>
  );
}
