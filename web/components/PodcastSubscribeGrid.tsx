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
      className="text-podcast-accent h-9 w-9 scale-125 sm:h-10 sm:w-10"
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
    <div className="mx-auto flex w-fit max-w-full flex-nowrap justify-center gap-x-2 overflow-x-auto pb-1">
      {PROVIDERS.map((provider) => (
        <a
          key={provider.name}
          aria-label={`Open ${provider.name}`}
          className="text-white focus-visible:ring-podcast-accent flex w-[4rem] shrink-0 items-center justify-center transition-opacity hover:opacity-85 focus:outline-none focus-visible:ring-2 sm:w-[4.25rem]"
          href={provider.href}
          onClick={(event) => event.preventDefault()}
        >
          <ProviderIcon icon={provider.icon} label={provider.name} />
        </a>
      ))}
    </div>
  );
}
