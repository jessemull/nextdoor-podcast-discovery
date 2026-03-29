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

import {
  Tooltip,
  TooltipContent,
  TooltipPortal,
  TooltipTrigger,
} from "@/components/ui/Tooltip";

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
      className="text-podcast-accent h-12 w-12 shrink-0"
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
    <div className="mx-auto flex max-w-full flex-row flex-wrap items-center justify-center gap-x-3 gap-y-2.5 py-1">
      {PROVIDERS.map((provider) => (
        <Tooltip key={provider.name}>
          <TooltipTrigger asChild>
            <a
              aria-label={`Open ${provider.name}`}
              className="text-white focus-visible:ring-podcast-accent flex shrink-0 items-center justify-center p-1 transition-opacity hover:opacity-85 focus:outline-none focus-visible:ring-2"
              href={provider.href}
              onClick={(event) => event.preventDefault()}
            >
              <ProviderIcon icon={provider.icon} label={provider.name} />
            </a>
          </TooltipTrigger>
          <TooltipPortal>
            <TooltipContent side="top">{provider.name}</TooltipContent>
          </TooltipPortal>
        </Tooltip>
      ))}
    </div>
  );
}
