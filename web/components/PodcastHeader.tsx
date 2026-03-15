"use client";

import { Search, X } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

const activeLinkClass =
  "text-podcast-accent underline decoration-2 decoration-podcast-accent underline-offset-[0.4em]";
const inactiveLinkClass =
  "text-podcast-foreground hover:text-podcast-accent transition-colors";
const linkFocusClass = "focus:outline-none";

const SEARCH_DEBOUNCE_MS = 200;
const SEARCH_WIDTH_CLOSED = "0px";
const SEARCH_WIDTH_OPEN = "clamp(10rem, 40vw, 20rem)";
const SEARCH_TRANSITION = "width 0.75s cubic-bezier(0, 0.11, 0.35, 2)";

export function PodcastHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const isHome = pathname === "/podcast" || pathname === "/";
  const isAbout = pathname === "/about";
  const isSubscribe = pathname === "/subscribe";

  const qFromUrl = searchParams.get("q") ?? "";
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchWidth, setSearchWidth] = useState<string>(SEARCH_WIDTH_CLOSED);
  const [inputValue, setInputValue] = useState(qFromUrl);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const expandRafRef = useRef<number | null>(null);

  useEffect(() => {
    setInputValue(qFromUrl);
  }, [qFromUrl]);

  useEffect(() => {
    if (isHome && qFromUrl) {
      setIsSearchOpen(true);
    }
  }, [isHome, qFromUrl]);

  useEffect(() => {
    if (isSearchOpen) {
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
    } else {
      setSearchWidth(SEARCH_WIDTH_CLOSED);
    }
  }, [isSearchOpen]);

  const updateUrl = useCallback(
    (value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value.trim()) {
        params.set("q", value.trim());
      } else {
        params.delete("q");
      }
      const query = params.toString();
      router.replace(query ? `/podcast?${query}` : "/podcast", { scroll: false });
    },
    [router, searchParams]
  );

  const handleSearchChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      setInputValue(value);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        updateUrl(value);
        debounceRef.current = null;
      }, SEARCH_DEBOUNCE_MS);
    },
    [updateUrl]
  );

  const openSearch = useCallback(() => {
    if (!isHome) {
      router.push("/podcast");
    }
    setIsSearchOpen(true);
  }, [isHome, router]);

  const handleSearchBlur = useCallback(() => {
    if (!inputValue.trim()) {
      setIsSearchOpen(false);
      setSearchWidth(SEARCH_WIDTH_CLOSED);
    }
  }, [inputValue]);

  const handleClearSearch = useCallback(() => {
    setInputValue("");
    updateUrl("");
    inputRef.current?.focus();
  }, [updateUrl]);

  return (
    <header className="w-full py-4">
      <nav
        aria-label="Main"
        className="flex flex-wrap items-center justify-center gap-8 px-4 text-lg sm:gap-10"
      >
        <Link
          aria-label="Home"
          className={`${isHome ? activeLinkClass : inactiveLinkClass} ${linkFocusClass}`}
          href="/podcast"
        >
          Home
        </Link>
        <Link
          className={`${isAbout ? activeLinkClass : inactiveLinkClass} ${linkFocusClass}`}
          href="/about"
        >
          About
        </Link>
        <Link
          className={`${isSubscribe ? activeLinkClass : inactiveLinkClass} ${linkFocusClass}`}
          href="/subscribe"
        >
          Subscribe
        </Link>
        <div className="flex items-center gap-1">
          {isSearchOpen ? (
            <>
              <Search
                aria-hidden
                className="text-podcast-accent h-4 w-4 shrink-0"
              />
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
                  className="border-border bg-surface text-podcast-foreground placeholder:text-podcast-muted w-full min-w-0 overflow-hidden rounded-lg border py-0.5 pl-3 pr-8 text-base focus:border-podcast-accent focus:outline-none focus:ring-1 focus:ring-podcast-accent"
                  data-podcast-search-input
                  placeholder="Search for episodes..."
                  ref={inputRef}
                  type="text"
                  value={inputValue}
                  onBlur={handleSearchBlur}
                  onChange={handleSearchChange}
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
            </>
          ) : (
            <button
              aria-label="Search for episodes"
              className={`flex items-center gap-1 ${linkFocusClass} text-podcast-foreground transition-colors hover:text-podcast-accent`}
              type="button"
              onClick={openSearch}
            >
              <Search aria-hidden className="h-4 w-4 shrink-0" />
              <span className="hidden sm:inline">Search</span>
            </button>
          )}
        </div>
      </nav>
    </header>
  );
}
