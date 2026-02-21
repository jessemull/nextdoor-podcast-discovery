import { SportsFact } from "@/components/SportsFact";
import { StatsPanel } from "@/components/StatsPanel";

export default function Home() {
  return (
    <main className="relative h-full overflow-auto">
      {/* Full-bleed banner: only behind main content (not navbar), grayscale + dark overlay */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-0 min-h-full w-full"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          alt=""
          className="h-full w-full object-cover opacity-40"
          src="/hero-banner.webp"
        />
        <div className="absolute inset-0 bg-black/50" />
      </div>

      {/* Content above the banner */}
      <div className="relative z-10">
        {/* Hero: title + sub-header; padding controls all spacing */}
        <section
          aria-label="Welcome"
          className="flex flex-col items-center px-6 pb-8 pt-16 text-center sm:px-8 sm:pb-6 sm:pt-28"
        >
          <h1
            className="text-foreground mb-3 max-w-2xl text-3xl font-bold tracking-tight animate-fade-in-up-slow opacity-0 sm:text-4xl md:text-5xl"
            style={{ animationDelay: "0s" } as React.CSSProperties}
          >
            Nextdoor Discovery
          </h1>
          <p
            className="text-muted max-w-lg text-base animate-fade-in-up-slow opacity-0 sm:text-lg md:text-xl"
            style={{ animationDelay: "0.5s" } as React.CSSProperties}
          >
            Discover and curate interesting Nextdoor posts for your podcast.
          </p>
        </section>

        {/* Content: sports fact and stats; staggered after hero then subheader */}
        <div className="mx-auto max-w-5xl space-y-16 px-6 pb-14 pt-10 sm:px-8 sm:pb-20 sm:pt-12">
          <div
            className="animate-fade-in-up-slow opacity-0"
            style={{ animationDelay: "1.2s" } as React.CSSProperties}
          >
            <SportsFact />
          </div>
          <div
            className="animate-fade-in-up-slow opacity-0"
            style={{ animationDelay: "1.2s" } as React.CSSProperties}
          >
            <StatsPanel />
          </div>
        </div>
      </div>
    </main>
  );
}
