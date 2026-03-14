import Link from "next/link";

export function PodcastFooter() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="border-border bg-surface mt-auto border-t">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 py-6 sm:flex-row sm:px-6">
        <p className="text-muted text-sm">
          &copy; {currentYear} Nextdoor Podcast. All rights reserved.
        </p>
        <nav aria-label="Footer" className="flex items-center gap-6">
          <Link
            className="text-muted hover:text-foreground text-sm transition-colors"
            href="/episodes"
          >
            Episodes
          </Link>
          <Link
            className="text-muted hover:text-foreground text-sm transition-colors"
            href="/about"
          >
            About
          </Link>
          <Link
            className="text-muted hover:text-foreground text-sm transition-colors"
            href="/subscribe"
          >
            Subscribe
          </Link>
        </nav>
      </div>
    </footer>
  );
}
