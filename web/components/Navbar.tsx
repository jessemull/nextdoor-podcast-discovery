"use client";

import { useUser } from "@auth0/nextjs-auth0/client";
import { LogOut, Mic } from "lucide-react";
import Link from "next/link";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import { cn } from "@/lib/utils";

const navLinkClass = cn(
  "flex items-center gap-2 text-muted hover:text-foreground transition-colors"
);

export function Navbar() {
  const { isLoading, user } = useUser();
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  const closeUserMenu = useCallback(() => setUserMenuOpen(false), []);

  useEffect(() => {
    if (!userMenuOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (
        userMenuRef.current &&
        !userMenuRef.current.contains(e.target as Node)
      ) {
        closeUserMenu();
      }
    };
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, [userMenuOpen, closeUserMenu]);

  const initial = user?.email?.slice(0, 1).toUpperCase() ?? "?";

  return (
    <nav className="border-border bg-surface border-b">
      <div className="flex w-full items-center justify-between px-4 py-3 sm:px-6">
        <Link
          aria-label="Go to home page"
          className="flex items-center gap-2 text-lg font-semibold text-foreground"
          href="/"
        >
          <Mic aria-hidden className="h-5 w-5" />
          Nextdoor Discovery
        </Link>

        <div className="flex items-center gap-4">
          <Link className={navLinkClass} href="/">
            Home
          </Link>
          <Link className={navLinkClass} href="/feed">
            Feed
          </Link>
          <Link className={navLinkClass} href="/jobs">
            Jobs
          </Link>
          <Link className={navLinkClass} href="/settings">
            Settings
          </Link>

          {isLoading ? (
            <span
              aria-label="Loading user"
              className={cn(
                "flex h-8 w-8 cursor-not-allowed items-center justify-center rounded-full bg-surface-hover text-muted text-sm font-medium opacity-60",
                "pointer-events-none"
              )}
            >
              ?
            </span>
          ) : user ? (
            <div className="relative" ref={userMenuRef}>
              <button
                aria-expanded={userMenuOpen}
                aria-haspopup="menu"
                aria-label="Open user menu"
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-full bg-surface-hover text-muted text-sm font-medium transition-colors",
                  "hover:bg-surface-hover/80 hover:text-foreground focus:outline-none focus:ring-2 focus:ring-border-focus"
                )}
                type="button"
                onClick={() => setUserMenuOpen((o) => !o)}
              >
                <span aria-hidden>{initial}</span>
              </button>

              {userMenuOpen && (
                <div
                  className="border-border bg-surface absolute right-0 top-full z-10 mt-1 min-w-[10rem] rounded-card border py-1 shadow-lg"
                  role="menu"
                >
                  <Link
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-foreground hover:bg-surface-hover"
                    href="/auth/logout"
                    onClick={closeUserMenu}
                    role="menuitem"
                  >
                    <LogOut aria-hidden className="h-4 w-4" />
                    Sign out
                  </Link>
                </div>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </nav>
  );
}
