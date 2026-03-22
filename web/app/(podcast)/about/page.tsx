import Image from "next/image";

import { playfair } from "@/lib/fonts";

import type { Metadata } from "next";

export const metadata: Metadata = {
  description:
    "Meet Matt and Maketa Auflick, co-hosts of Was that a gunshot? — the podcast about neighborhood drama and Nextdoor culture.",
  title: "About | Podcast",
};

const HOSTS = [
  {
    bioParagraphs: [
      "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Integer nec odio praesent libero sed cursus ante dapibus diam. Sed nisi nulla quis sem at nibh elementum imperdiet.",
      "Duis sagittis ipsum praesent mauris fusce nec tellus sed augue semper porta. Mauris massa curabitur quis urna natoque penatibus magnis dis parturient montes nascetur ridiculus mus.",
    ],
    imageSrc: "/bio-matt.jpg",
    name: "Matt Auflick",
  },
  {
    bioParagraphs: [
      "Vestibulum lacinia arcu eget nulla class aptent taciti sociosqu ad litora torquent per conubia nostra inceptos himenaeos curabitur sodales ligula in libero sed dignissim lacinia.",
      "Nam nec ante sed lacinia urna non tincidunt mattis tortor neque. Praesent blandit dolor sed non quam in vel mi sit amet augue fringilla euismod donec tempus vulputate magna.",
    ],
    imageSrc: "/bio-maketa.jpg",
    name: "Maketa Auflick",
  },
];

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-6xl px-5 py-10 sm:px-7 md:py-14">
      <header className="mb-12 md:mb-16">
        <p className="text-podcast-accent mb-3 text-xs font-semibold uppercase tracking-widest">
          The hosts
        </p>
        <h1
          className={`text-podcast-foreground max-w-3xl text-3xl font-semibold leading-tight sm:text-4xl ${playfair.className}`}
        >
          Meet the voices behind the neighborhood stories
        </h1>
      </header>

      <div className="mx-auto grid max-w-5xl grid-cols-1 gap-12 md:grid-cols-2 md:gap-x-10 md:gap-y-12">
        {HOSTS.map((host) => {
          const headingId = `host-${host.name.toLowerCase().replace(/\s+/g, "-")}`;

          return (
            <article key={host.name} aria-labelledby={headingId}>
              <div className="relative mb-5 aspect-[3/4] w-full overflow-hidden rounded-3xl border border-podcast-accent">
                <Image
                  alt={`Portrait of ${host.name}`}
                  className="object-cover"
                  fill
                  sizes="(max-width: 768px) 100vw, 45vw"
                  src={host.imageSrc}
                />
              </div>
              <h2
                className="text-podcast-foreground mb-3 text-lg font-bold"
                id={headingId}
              >
                {host.name}, co-host
              </h2>
              <div className="text-podcast-muted space-y-3 text-left text-base leading-relaxed">
                {host.bioParagraphs.map((paragraph, index) => (
                  <p key={`${host.name}-${index}`}>{paragraph}</p>
                ))}
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
