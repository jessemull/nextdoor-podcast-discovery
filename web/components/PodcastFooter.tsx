import Link from "next/link";

export function PodcastFooter() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="border-border bg-surface mt-auto shrink-0 border-t">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 py-6 sm:flex-row sm:px-6">
        <p className="text-podcast-muted text-sm">
          &copy; {currentYear} Was that a gunshot?
        </p>
        <nav aria-label="Footer" className="flex items-center gap-6">
          <Link
            className="text-podcast-muted hover:text-podcast-accent text-sm transition-colors"
            href="/podcast"
          >
            Episodes
          </Link>
          <Link
            className="text-podcast-muted hover:text-podcast-accent text-sm transition-colors"
            href="/about"
          >
            About
          </Link>
          <Link
            className="text-podcast-muted hover:text-podcast-accent text-sm transition-colors"
            href="/subscribe"
          >
            Subscribe
          </Link>
        </nav>
      </div>
    </footer>
  );
}
