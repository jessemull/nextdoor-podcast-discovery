"use client";

import { Mic, Search } from "lucide-react";
import Link from "next/link";

export function PodcastHeader() {
  return (
    <header className="border-border bg-surface border-b">
      <div className="flex w-full items-center justify-between px-4 py-3 sm:px-6">
        <div className="flex items-center gap-4">
          <Link
            aria-label="Podcast home"
            className="flex items-center gap-2 text-lg font-semibold text-foreground"
            href="/"
          >
            <Mic aria-hidden className="h-5 w-5" />
            <span className="hidden sm:inline">Podcast</span>
          </Link>
          <nav aria-label="Main" className="flex items-center gap-4">
            <Link
              className="text-muted hover:text-foreground text-sm font-medium transition-colors"
              href="/episodes"
            >
              Episodes
            </Link>
            <Link
              className="text-muted hover:text-foreground text-sm font-medium transition-colors"
              href="/about"
            >
              About
            </Link>
            <Link
              className="text-muted hover:text-foreground text-sm font-medium transition-colors"
              href="/subscribe"
            >
              Subscribe
            </Link>
          </nav>
        </div>
        <Link
          aria-label="Search episodes"
          className="text-muted hover:text-foreground flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-border-focus"
          href="/search"
        >
          <Search aria-hidden className="h-4 w-4" />
          <span className="hidden sm:inline">Search</span>
        </Link>
      </div>
    </header>
  );
}
