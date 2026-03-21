"use client";

import {
  siApplepodcasts,
  siCastbox,
  siIheartradio,
  siOvercast,
  siPodcastaddict,
  siPocketcasts,
  siRss,
  siSpotify,
  siYoutubemusic,
  type SimpleIcon,
} from "simple-icons";

import { playfair } from "@/lib/fonts";

interface PodcastProvider {
  href: string;
  icon: SimpleIcon;
  name: string;
}

const PROVIDERS: PodcastProvider[] = [
  { href: "#", icon: siApplepodcasts, name: "Apple Podcasts" },
  { href: "#", icon: siSpotify, name: "Spotify" },
  { href: "#", icon: siYoutubemusic, name: "YouTube Music" },
  { href: "#", icon: siPodcastaddict, name: "Podcast Addict" },
  { href: "#", icon: siPocketcasts, name: "Pocket Casts" },
  { href: "#", icon: siOvercast, name: "Overcast" },
  { href: "#", icon: siCastbox, name: "Castbox" },
  { href: "#", icon: siIheartradio, name: "iHeartRadio" },
  { href: "#", icon: siRss, name: "RSS Feed" },
];

function ProviderIcon({
  icon,
  label,
}: {
  icon: SimpleIcon;
  label: string;
}) {
  return (
    <svg
      aria-hidden
      className="text-podcast-accent h-10 w-10 sm:h-12 sm:w-12"
      fill="currentColor"
      role="img"
      viewBox="0 0 24 24"
    >
      <title>{label}</title>
      <path d={icon.path} />
    </svg>
  );
}

export function PodcastSubscribeGrid() {
  return (
    <div className="mx-auto grid justify-center gap-4 [grid-template-columns:repeat(3,6rem)] sm:[grid-template-columns:repeat(5,6rem)] lg:[grid-template-columns:repeat(9,6rem)]">
      {PROVIDERS.map((provider) => (
        <a
          key={provider.name}
          aria-label={`Open ${provider.name}`}
          className="text-white focus-visible:ring-podcast-accent flex w-full flex-col items-center justify-start gap-2 p-1 transition-opacity hover:opacity-85 focus:outline-none focus-visible:ring-2"
          href={provider.href}
          onClick={(event) => event.preventDefault()}
        >
          <ProviderIcon icon={provider.icon} label={provider.name} />
          <span
            className={`text-podcast-foreground text-center text-xs font-medium leading-tight ${playfair.className}`}
          >
            {provider.name}
          </span>
        </a>
      ))}
    </div>
  );
}
