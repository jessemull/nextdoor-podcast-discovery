import { SportsFact } from "@/components/SportsFact";
import { StatsPanel } from "@/components/StatsPanel";

export default function Home() {
  return (
    <main className="min-h-screen">
      {/* Hero: centered title + sub-header */}
      <section
        aria-label="Welcome"
        className="flex min-h-[40vh] flex-col items-center justify-center px-6 py-16 text-center"
      >
        <h1
          className="text-foreground mb-3 max-w-2xl text-4xl font-bold tracking-tight animate-fade-in-up-hero opacity-0 sm:text-5xl"
        >
          Nextdoor Podcast Discovery
        </h1>
        <p
          className="text-muted max-w-lg text-lg animate-fade-in-up-sub opacity-0 sm:text-xl"
          style={{ animationDelay: "1.5s" } as React.CSSProperties}
        >
          Discover and curate interesting Nextdoor posts for your podcast.
        </p>
      </section>

      {/* Content: sports fact and stats fade in slightly after sub-header (same speed) */}
      <div className="mx-auto max-w-5xl px-6 pb-16">
        <div
          className="animate-fade-in-up-sub opacity-0"
          style={{ animationDelay: "2s" } as React.CSSProperties}
        >
          <SportsFact />
        </div>
        <div
          className="animate-fade-in-up-sub opacity-0"
          style={{ animationDelay: "2s" } as React.CSSProperties}
        >
          <StatsPanel />
        </div>
      </div>
    </main>
  );
}
