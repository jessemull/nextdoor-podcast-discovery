"use client";

import { Menu, Search, X } from "lucide-react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { usePodcastSearch } from "@/components/PodcastSearchProvider";
import { playfair } from "@/lib/fonts";

const activeLinkClass =
  "text-podcast-accent underline decoration-2 decoration-podcast-accent underline-offset-[0.4em]";
const inactiveLinkClass =
  "text-podcast-foreground hover:text-podcast-accent transition-colors";
const linkFocusClass = "focus:outline-none";

const SEARCH_WIDTH_CLOSED = "0px";
const SEARCH_WIDTH_OPEN = "clamp(10rem, 40vw, 20rem)";
const SEARCH_TRANSITION = "width 0.75s cubic-bezier(0, 0.11, 0.35, 2)";
const SEARCH_TRANSITION_MS = 750;
const PODCAST_NAME = "Was that a gunshot?";

export function PodcastHeader() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { commitSearch, handleClear, handleSearchChange, inputValue } =
    usePodcastSearch();

  const isHome = pathname === "/podcast" || pathname === "/";
  const isAbout = pathname === "/about";
  const isCategories =
    pathname === "/categories" || pathname.startsWith("/categories/");
  const isSubscribe = pathname === "/subscribe";

  const qFromUrl = searchParams.get("q") ?? "";
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchWidth, setSearchWidth] = useState<string>(SEARCH_WIDTH_CLOSED);
  const closeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const expandRafRef = useRef<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isHome || !qFromUrl) return;
    const id = requestAnimationFrame(() => {
      setIsSearchOpen(true);
    });
    return () => cancelAnimationFrame(id);
  }, [isHome, qFromUrl]);

  /* eslint-disable react-hooks/set-state-in-effect -- desktop search width animation (expand/collapse) */
  useEffect(() => {
    if (isSearchOpen && !isClosing) {
      if (expandRafRef.current != null) cancelAnimationFrame(expandRafRef.current);
      setSearchWidth(SEARCH_WIDTH_CLOSED);
      expandRafRef.current = requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setSearchWidth(SEARCH_WIDTH_OPEN);
          expandRafRef.current = null;
        });
      });
      const t = setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
      return () => {
        clearTimeout(t);
        if (expandRafRef.current != null) cancelAnimationFrame(expandRafRef.current);
      };
    }
    if (!isSearchOpen && !isClosing) {
      setSearchWidth(SEARCH_WIDTH_CLOSED);
    }
  }, [isClosing, isSearchOpen]);
  /* eslint-enable react-hooks/set-state-in-effect */

  useEffect(() => {
    if (!isClosing) return;
    if (closeTimeoutRef.current) clearTimeout(closeTimeoutRef.current);
    closeTimeoutRef.current = setTimeout(() => {
      setIsClosing(false);
      setIsSearchOpen(false);
      closeTimeoutRef.current = null;
    }, SEARCH_TRANSITION_MS);
    return () => {
      if (closeTimeoutRef.current) clearTimeout(closeTimeoutRef.current);
    };
  }, [isClosing]);

  useEffect(() => {
    if (!mobileMenuOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [mobileMenuOpen]);

  useEffect(() => {
    if (!mobileMenuOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMobileMenuOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [mobileMenuOpen]);

  const openSearch = useCallback(() => {
    setIsClosing(false);
    setIsSearchOpen(true);
  }, []);

  const handleSearchBlur = useCallback(() => {
    if (!inputValue.trim()) {
      setIsClosing(true);
      setSearchWidth(SEARCH_WIDTH_CLOSED);
    }
  }, [inputValue]);

  const handleClearSearch = useCallback(() => {
    handleClear();
    inputRef.current?.focus();
  }, [handleClear]);

  const closeMobileMenu = useCallback(() => setMobileMenuOpen(false), []);

  const navLinks = (
    <>
      <Link
        aria-label="Home"
        className={`${isHome ? activeLinkClass : inactiveLinkClass} ${linkFocusClass}`}
        href="/podcast"
        onClick={closeMobileMenu}
      >
        Home
      </Link>
      <Link
        className={`${isAbout ? activeLinkClass : inactiveLinkClass} ${linkFocusClass}`}
        href="/about"
        onClick={closeMobileMenu}
      >
        About
      </Link>
      <Link
        className={`${isCategories ? activeLinkClass : inactiveLinkClass} ${linkFocusClass}`}
        href="/categories"
        onClick={closeMobileMenu}
      >
        Categories
      </Link>
      <Link
        className={`${isSubscribe ? activeLinkClass : inactiveLinkClass} ${linkFocusClass}`}
        href="/subscribe"
        onClick={closeMobileMenu}
      >
        Subscribe
      </Link>
    </>
  );

  return (
    <header className="w-full shrink-0 pb-3 pt-3 md:pb-5 md:pt-6">
      <div className="mx-auto w-full max-w-6xl px-5 sm:px-7">
      {/* Mobile: hamburger (overlay covers this while menu is open) */}
      <div
        aria-hidden={mobileMenuOpen}
        className="flex min-h-12 items-center justify-between gap-3 md:hidden"
      >
        <span
          className={`text-podcast-foreground min-w-0 flex-1 truncate text-3xl leading-tight ${playfair.className}`}
        >
          {PODCAST_NAME}
        </span>
        <button
          aria-controls="podcast-mobile-menu"
          aria-expanded={mobileMenuOpen}
          aria-label="Open menu"
          className={`text-podcast-foreground inline-flex min-h-10 min-w-10 shrink-0 items-center justify-center rounded-lg transition-colors hover:text-podcast-accent ${linkFocusClass} focus-visible:ring-2 focus-visible:ring-podcast-accent focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)]`}
          type="button"
          onClick={() => setMobileMenuOpen(true)}
        >
          <Menu aria-hidden className="h-7 w-7 translate-y-0.5" />
        </button>
      </div>

      {/* Mobile: full-screen menu */}
      {mobileMenuOpen ? (
        <div
          aria-modal="true"
          className="fixed inset-0 z-[100] flex flex-col bg-[#0a0a0a] md:hidden"
          id="podcast-mobile-menu"
          role="dialog"
        >
          <div className="flex shrink-0 justify-end px-5 pt-6 sm:px-7">
            <button
              aria-label="Close menu"
              className={`text-podcast-foreground inline-flex min-h-10 min-w-10 items-center justify-center rounded-lg transition-colors hover:text-podcast-accent ${linkFocusClass} focus-visible:ring-2 focus-visible:ring-podcast-accent focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0a0a]`}
              type="button"
              onClick={closeMobileMenu}
            >
              <X aria-hidden className="h-7 w-7" />
            </button>
          </div>
          <nav
            aria-label="Main"
            className="flex flex-1 flex-col items-center justify-center gap-10 px-6 pb-16 text-center font-serif text-2xl sm:text-3xl"
          >
            {navLinks}
          </nav>
        </div>
      ) : null}

      {/* Desktop: inline nav + expandable search */}
      <nav
        aria-label="Main"
        className="hidden flex-wrap items-center justify-center gap-8 text-lg sm:gap-10 md:flex"
      >
        {navLinks}
        <div className="flex min-h-7 items-center gap-1">
          <button
            aria-label="Search for episodes"
            className={`inline-flex min-h-7 items-center border-0 bg-transparent p-0 leading-7 ${linkFocusClass} text-podcast-foreground ${
              isSearchOpen && !isClosing ? "gap-0" : "gap-1"
            } ${
              isSearchOpen || isClosing ? "" : "transition-colors hover:text-podcast-accent"
            }`}
            type="button"
            onClick={isSearchOpen || isClosing ? undefined : openSearch}
          >
            <Search
              aria-hidden
              className={`h-4 w-4 shrink-0 ${
                isSearchOpen && !isClosing ? "text-podcast-accent" : ""
              }`}
            />
            <span
              className={`hidden leading-7 sm:inline ${
                isSearchOpen && !isClosing
                  ? "w-0 overflow-hidden opacity-0"
                  : "w-auto opacity-100"
              }`}
            >
              Search
            </span>
          </button>
          <div
            className="podcast-search-wrapper relative overflow-hidden"
            style={{
              maxWidth: SEARCH_WIDTH_OPEN,
              transition: SEARCH_TRANSITION,
              width: searchWidth,
            }}
          >
            <input
              aria-label="Search for episodes"
              className={`bg-surface text-podcast-foreground placeholder:text-podcast-muted w-full min-w-0 overflow-hidden rounded-lg border-2 py-0.5 pl-3 pr-8 text-base focus:outline-none ${
                isSearchOpen || isClosing ? "border-podcast-accent" : "border-border"
              }`}
              data-podcast-search-input
              placeholder="Search for episodes..."
              ref={inputRef}
              type="text"
              value={inputValue}
              onBlur={handleSearchBlur}
              onChange={handleSearchChange}
              onKeyDown={(event) => {
                if (event.key !== "Enter") return;
                event.preventDefault();
                commitSearch(event.currentTarget.value);
              }}
            />
            {inputValue ? (
              <button
                aria-label="Clear search"
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-white transition-opacity hover:opacity-80 focus:outline-none focus:ring-2 focus:ring-podcast-accent focus:ring-offset-2 focus:ring-offset-surface"
                type="button"
                onClick={handleClearSearch}
              >
                <X aria-hidden className="h-3.5 w-3.5" />
              </button>
            ) : null}
          </div>
        </div>
      </nav>
      </div>
    </header>
  );
}
