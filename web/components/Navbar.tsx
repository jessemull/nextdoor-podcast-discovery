"use client";

import {
  LayoutDashboard,
  ListTodo,
  LogOut,
  Mic,
  Search,
  Settings,
  User,
} from "lucide-react";
import { signOut, useSession } from "next-auth/react";
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
  const { data: session, status } = useSession();
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

  const initial = session?.user?.email?.slice(0, 1).toUpperCase() ?? "?";

  return (
    <nav className="border-border bg-surface border-b">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <Link
          aria-label="Go to home page"
          className="flex items-center gap-2 text-lg font-semibold text-foreground"
          href="/"
        >
          <Mic aria-hidden className="h-5 w-5" />
          Podcast Discovery
        </Link>

        <div className="flex items-center gap-4">
          <Link className={navLinkClass} href="/feed">
            <LayoutDashboard aria-hidden className="h-5 w-5" />
            <span className="hidden sm:inline">Feed</span>
          </Link>
          <Link className={navLinkClass} href="/search">
            <Search aria-hidden className="h-5 w-5" />
            <span className="hidden sm:inline">Search</span>
          </Link>
          <Link className={navLinkClass} href="/jobs">
            <ListTodo aria-hidden className="h-5 w-5" />
            <span className="hidden sm:inline">Jobs</span>
          </Link>
          <Link className={navLinkClass} href="/settings">
            <Settings aria-hidden className="h-5 w-5" />
            <span className="hidden sm:inline">Settings</span>
          </Link>

          {status === "loading" ? (
            <span className="text-muted-foreground text-sm">Loading...</span>
          ) : session ? (
            <div className="relative" ref={userMenuRef}>
              <button
                aria-expanded={userMenuOpen}
                aria-haspopup="menu"
                aria-label="Open user menu"
                className={cn(
                  "flex items-center gap-2 rounded-md border border-border bg-background px-2 py-1.5 transition-colors",
                  "hover:bg-surface-hover focus:border-border-focus focus:outline-none focus:ring-2 focus:ring-border-focus"
                )}
                type="button"
                onClick={() => setUserMenuOpen((o) => !o)}
              >
                <span
                  aria-hidden
                  className="flex h-7 w-7 items-center justify-center rounded-full border border-border bg-surface-hover text-muted text-sm font-medium"
                >
                  {initial}
                </span>
                <User aria-hidden className="h-4 w-4 text-muted sm:hidden" />
              </button>

              {userMenuOpen && (
                <div
                  className="border-border bg-surface absolute right-0 top-full z-10 mt-1 min-w-[10rem] rounded-card border py-1 shadow-lg"
                  role="menu"
                >
                  <Link
                    className="flex items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-surface-hover"
                    href="/settings"
                    role="menuitem"
                    onClick={closeUserMenu}
                  >
                    <Settings aria-hidden className="h-4 w-4" />
                    Settings
                  </Link>
                  <button
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-foreground hover:bg-surface-hover"
                    role="menuitem"
                    type="button"
                    onClick={() => {
                      closeUserMenu();
                      signOut();
                    }}
                  >
                    <LogOut aria-hidden className="h-4 w-4" />
                    Sign out
                  </button>
                </div>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </nav>
  );
}
