import { SportsFact } from "@/components/SportsFact";
import { StatsPanel } from "@/components/StatsPanel";

export default function Home() {
  return (
    <main className="min-h-screen">
      {/* Hero: centered title + sub-header; equal space below navbar and below sub-header */}
      <section
        aria-label="Welcome"
        className="flex min-h-[40vh] flex-col items-center justify-center px-6 pt-4 pb-8 text-center"
      >
        <h1
          className="text-foreground mb-3 max-w-2xl text-4xl font-bold tracking-tight animate-fade-in-up-slow opacity-0 sm:text-5xl"
          style={{ animationDelay: "0s" } as React.CSSProperties}
        >
          Nextdoor Podcast Discovery
        </h1>
        <p
          className="text-muted max-w-lg text-lg animate-fade-in-up-slow opacity-0 sm:text-xl"
          style={{ animationDelay: "1.4s" } as React.CSSProperties}
        >
          Discover and curate interesting Nextdoor posts for your podcast.
        </p>
      </section>

      {/* Content: sports fact and stats; same fade duration and gap as above */}
      <div className="mx-auto max-w-5xl px-6 pb-16">
        <div
          className="animate-fade-in-up-slow opacity-0"
          style={{ animationDelay: "2.8s" } as React.CSSProperties}
        >
          <SportsFact />
        </div>
        <div
          className="animate-fade-in-up-slow opacity-0"
          style={{ animationDelay: "2.8s" } as React.CSSProperties}
        >
          <StatsPanel />
        </div>
      </div>
    </main>
  );
}
