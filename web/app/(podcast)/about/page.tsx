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
      <div className="mx-auto flex w-full max-w-full flex-col md:w-max">
        <header className="mb-12 md:mb-16">
          <p className="text-podcast-accent mb-3 text-base font-semibold uppercase tracking-widest">
            The hosts
          </p>
          <h1
            className={`text-podcast-foreground max-w-5xl text-3xl font-semibold leading-tight sm:text-4xl ${playfair.className}`}
          >
            <span className="block sm:whitespace-nowrap">
              Meet the voices behind the neighborhood
            </span>
            <span className="block">stories</span>
          </h1>
        </header>

        <div className="flex flex-col items-center gap-10 md:flex-row md:items-start md:justify-start md:gap-5">
        {HOSTS.map((host) => {
          const headingId = `host-${host.name.toLowerCase().replace(/\s+/g, "-")}`;

          return (
            <article
              key={host.name}
              aria-labelledby={headingId}
              className="mx-auto w-[64%] max-w-[19.2rem] shrink-0 sm:max-w-[22.4rem] md:mx-0"
            >
              <div className="relative mb-3 aspect-[3/4] w-full overflow-hidden rounded-3xl border border-podcast-accent">
                <Image
                  alt={`Portrait of ${host.name}`}
                  className="object-cover"
                  fill
                  sizes="(max-width: 768px) 56vw, 30vw"
                  src={host.imageSrc}
                />
              </div>
              <h2
                className="text-podcast-foreground mb-3 text-lg font-bold"
                id={headingId}
              >
                {host.name},{" "}
                <span className="text-podcast-accent">Co-Host</span>
              </h2>
              <div className="text-podcast-muted space-y-3 text-left text-[0.8rem] leading-relaxed sm:text-[0.85rem]">
                {host.bioParagraphs.map((paragraph, index) => (
                  <p key={`${host.name}-${index}`}>{paragraph}</p>
                ))}
              </div>
            </article>
          );
        })}
        </div>
      </div>
    </div>
  );
}
