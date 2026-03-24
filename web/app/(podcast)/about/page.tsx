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
    <div className="mx-auto max-w-6xl px-5 pt-10 pb-16 sm:px-7 md:pt-14 md:pb-24">
      <div className="mx-auto flex w-full max-w-full flex-col md:w-max">
        <header className="mb-10 md:mb-16">
          <p className="text-podcast-accent mb-1 text-base font-semibold uppercase tracking-widest md:mb-3">
            The hosts
          </p>
          <h1
            className={`text-podcast-foreground max-w-5xl text-2xl font-semibold leading-tight md:text-3xl md:leading-tight lg:text-4xl ${playfair.className}`}
          >
            <span className="md:hidden">From the neighborhood</span>
            <span className="hidden md:block">
              <span className="block md:whitespace-nowrap">
                Meet the voices behind the neighborhood
              </span>
              <span className="block">stories</span>
            </span>
          </h1>
        </header>

        <div className="flex flex-col gap-10 md:flex-row md:items-start md:justify-start md:gap-5">
        {HOSTS.map((host) => {
          const headingId = `host-${host.name.toLowerCase().replace(/\s+/g, "-")}`;

          return (
            <article
              key={host.name}
              aria-labelledby={headingId}
              className="w-full shrink-0 md:max-w-[19.2rem] lg:max-w-[22.4rem]"
            >
              <div className="relative mb-3 aspect-[3/4] w-full overflow-hidden rounded-3xl border border-podcast-accent">
                <Image
                  alt={`Portrait of ${host.name}`}
                  className="object-cover"
                  fill
                  sizes="(max-width: 768px) 100vw, 30vw"
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
