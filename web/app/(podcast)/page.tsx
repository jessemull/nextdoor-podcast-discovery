import Image from "next/image";
import Link from "next/link";

import { PodcastEpisodeList } from "@/components/PodcastEpisodeList";
import { getEpisodesPublishedSafe } from "@/lib/podcast.server";
import { siteBaseUrl } from "@/lib/site-url.server";

import type { Metadata } from "next";
import { playfair } from "../layout";

const PODCAST_NAME = "Was that a gunshot?";
const TAGLINE =
  "Breaking down the internet's weirdest neighborhood drama with Matt and Maketa Auflick.";
const DESCRIPTION = "In neighborhoods across the country, one question echoes through the night: Was that a gunshot? Each week, Matt and Maketa take a humorous dive into the strange, suspicious, and unintentionally hilarious posts that fill Nextdoor feeds everywhere. From blurry security camera photos to debates over fireworks versus crime, they unpack the peculiar dynamics of neighborhood vigilance and the surprisingly dramatic ways we interact with the people living just down the street."

export const metadata: Metadata = {
  description: DESCRIPTION,
  openGraph: {
    description: TAGLINE,
    title: PODCAST_NAME,
    type: "website",
    url: "/podcast",
  },
  title: PODCAST_NAME,
  twitter: {
    card: "summary_large_image",
    description: DESCRIPTION,
    title: PODCAST_NAME,
  },
};

export const revalidate = 60;

export default async function PodcastHomePage() {
  const episodes = await getEpisodesPublishedSafe(50, 0);
  const base = siteBaseUrl;
  const seriesJsonLd = {
    "@context": "https://schema.org",
    "@type": "PodcastSeries",
    description: TAGLINE,
    name: PODCAST_NAME,
    url: `${base}/podcast`,
  };

  return (
    <div className="mx-auto mt-8 max-w-6xl px-4 py-8 sm:px-6">
      <script
        dangerouslySetInnerHTML={{ __html: JSON.stringify(seriesJsonLd) }}
        type="application/ld+json"
      />
      <div className="flex flex-col gap-8 md:flex-row md:items-stretch md:gap-10">
        {/* Left column: logo — rectangle, no clipping, height spans hero */}
        <aside
          aria-hidden
          className="flex shrink-0 justify-center md:min-h-[420px] md:w-[20rem] md:justify-start"
        >
          <div className="relative h-72 w-72 shrink-0 overflow-hidden rounded-3xl border border-podcast-accent md:h-full md:w-[20rem]">
            <Image
              alt={PODCAST_NAME}
              className="object-cover object-left"
              fill
              priority
              sizes="(max-width: 768px) 160px, 192px"
              src="/logo.png"
            />
          </div>
        </aside>

        {/* Right column: hero + copy */}
        <div className="min-w-0 flex-1 md:max-w-2xl">
          {/* Hero */}
          <section
            aria-label="Introduction"
            className="mb-10 md:mb-0 md:flex md:h-full md:flex-col"
          >
            <h1
              className={`text-podcast-foreground mb-4 text-5xl font-bold tracking-tight sm:text-7xl ${playfair.className}`}
            >
              {PODCAST_NAME}
            </h1>
            <p className="text-podcast-muted mb-4 text-xl text-[#9fb7c4]">
              Breaking down the internet&apos;s weirdest neighborhood drama with{" "}
              <strong className="text-white">Matt</strong> and{" "}
              <strong className="text-white">Maketa Auflick</strong>.
            </p>
            <p className="text-podcast-muted mb-6 text-lg leading-relaxed text-[#9fb7c4]">
              {DESCRIPTION}
            </p>
            <Link
              className="mb-5 inline-flex w-full items-center justify-center rounded-full border border-podcast-accent px-10 py-3 text-base font-medium text-podcast-accent transition-colors hover:bg-podcast-accent hover:text-black active:bg-podcast-accent active:text-black focus:outline-none focus:ring-2 focus:ring-podcast-accent focus:ring-offset-2 focus:ring-offset-[var(--background)]"
              href="/subscribe"
            >
              Subscribe
            </Link>
            <div className="flex flex-wrap items-center justify-between gap-4 text-lg md:mt-auto">
              <p className="text-[#9fb7c4]">
                E-mail{" "}
                <a
                  className="text-podcast-accent hover:underline"
                  href="mailto:info@wasthatagunshot.com"
                >
                  info@wasthatagunshot.com
                </a>
              </p>
              <div className="flex items-center gap-1.5">
                <a
                  aria-label="LinkedIn"
                  className="flex h-10 w-10 items-center justify-center rounded-full text-white transition-opacity hover:opacity-80"
                  href="https://linkedin.com"
                  rel="noopener noreferrer"
                  target="_blank"
                >
                <svg
                  aria-hidden
                  className="h-8 w-8"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
                </svg>
              </a>
              <a
                aria-label="Twitter"
                className="flex h-10 w-10 items-center justify-center rounded-full text-white transition-opacity hover:opacity-80"
                href="https://twitter.com"
                rel="noopener noreferrer"
                target="_blank"
              >
                <svg
                  aria-hidden
                  className="h-8 w-8"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                </svg>
              </a>
              <a
                aria-label="Instagram"
                className="flex h-10 w-10 items-center justify-center rounded-full text-white transition-opacity hover:opacity-80"
                href="https://instagram.com"
                rel="noopener noreferrer"
                target="_blank"
              >
                <svg
                  aria-hidden
                  className="h-8 w-8"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
                </svg>
              </a>
              <a
                aria-label="Facebook"
                className="flex h-10 w-10 items-center justify-center rounded-full text-white transition-opacity hover:opacity-80"
                href="https://facebook.com"
                rel="noopener noreferrer"
                target="_blank"
              >
                <svg
                  aria-hidden
                  className="h-8 w-8"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                </svg>
              </a>
            </div>
            </div>
          </section>
        </div>
      </div>
      {/* Episode list (filtered by header search) spans full width under hero + logo */}
      <section aria-label="Episodes" className="mt-[5rem]">
        <PodcastEpisodeList episodes={episodes} />
      </section>
    </div>
  );
}
