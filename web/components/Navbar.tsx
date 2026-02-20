"use client";

import { useUser } from "@auth0/nextjs-auth0/client";
import { LogOut, Menu, Mic, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
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

const NAV_LINKS = [
  { href: "/", label: "Home" },
  { href: "/feed", label: "Feed" },
  { href: "/jobs", label: "Jobs" },
  { href: "/stats", label: "Stats" },
  { href: "/settings", label: "Settings" },
] as const;

export function Navbar() {
  const { isLoading, user } = useUser();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const mobileMenuRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);

  const closeUserMenu = useCallback(() => setUserMenuOpen(false), []);
  const closeMobileMenu = useCallback(() => setMobileMenuOpen(false), []);

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

  useEffect(() => {
    if (!mobileMenuOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (
        mobileMenuRef.current &&
        !mobileMenuRef.current.contains(e.target as Node)
      ) {
        closeMobileMenu();
      }
    };
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, [mobileMenuOpen, closeMobileMenu]);

  const pathname = usePathname();
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

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

        {/* Desktop nav: visible from md up */}
        <div className="hidden items-center gap-4 md:flex">
          {NAV_LINKS.map(({ href, label }) => (
            <Link
              key={href}
              className={navLinkClass}
              href={href}
            >
              {label}
            </Link>
          ))}

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
                    role="menuitem"
                    onClick={closeUserMenu}
                  >
                    <LogOut aria-hidden className="h-4 w-4" />
                    Sign out
                  </Link>
                </div>
              )}
            </div>
          ) : null}
        </div>

        {/* Mobile: hamburger + user avatar (or loading) */}
        <div className="flex items-center gap-2 md:hidden">
          {user && !isLoading && (
            <div className="relative" ref={userMenuRef}>
              <button
                aria-expanded={userMenuOpen}
                aria-haspopup="menu"
                aria-label="Open user menu"
                className={cn(
                  "flex h-9 w-9 items-center justify-center rounded-full bg-surface-hover text-muted text-sm font-medium transition-colors",
                  "hover:bg-surface-hover/80 hover:text-foreground focus:outline-none focus:ring-2 focus:ring-border-focus"
                )}
                type="button"
                onClick={() => setUserMenuOpen((o) => !o)}
              >
                <span aria-hidden>{initial}</span>
              </button>

              {userMenuOpen && (
                <div
                  className="border-border bg-surface absolute right-0 top-full z-50 mt-1 min-w-[10rem] rounded-card border py-1 shadow-lg"
                  role="menu"
                >
                  <Link
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-foreground hover:bg-surface-hover"
                    href="/auth/logout"
                    role="menuitem"
                    onClick={() => {
                      closeUserMenu();
                      closeMobileMenu();
                    }}
                  >
                    <LogOut aria-hidden className="h-4 w-4" />
                    Sign out
                  </Link>
                </div>
              )}
            </div>
          )}
          {isLoading && (
            <span
              aria-label="Loading user"
              className="flex h-9 w-9 cursor-not-allowed items-center justify-center rounded-full bg-surface-hover text-muted text-sm font-medium opacity-60 pointer-events-none"
            >
              ?
            </span>
          )}

          <button
            aria-expanded={mobileMenuOpen}
            aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
            className={cn(
              "flex h-10 w-10 items-center justify-center rounded-lg text-foreground transition-colors",
              "hover:bg-surface-hover focus:outline-none focus:ring-2 focus:ring-border-focus"
            )}
            type="button"
            onClick={() => setMobileMenuOpen((o) => !o)}
          >
            {mobileMenuOpen ? (
              <X aria-hidden className="h-6 w-6" />
            ) : (
              <Menu aria-hidden className="h-6 w-6" />
            )}
          </button>
        </div>
      </div>

      {/* Mobile menu drawer */}
      {mobileMenuOpen && (
        <>
          <div
            aria-hidden
            className="fixed inset-0 z-40 bg-black/50 md:hidden"
            onClick={closeMobileMenu}
          />
          <div
            aria-label="Navigation menu"
            aria-modal="true"
            className="border-border bg-surface fixed inset-y-0 right-0 z-50 flex w-full flex-col border-l shadow-lg sm:w-72 sm:max-w-[85vw] md:hidden"
            ref={mobileMenuRef}
            role="dialog"
          >
            <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-3">
              <div className="flex min-h-[44px] items-center justify-between">
                <Link
                  className="focus:bg-surface-hover flex min-h-[44px] flex-1 items-center rounded-lg px-4 py-2 text-base font-medium text-foreground hover:bg-surface-hover focus:outline-none focus:ring-2 focus:ring-border-focus"
                  href={NAV_LINKS[0].href}
                  onClick={closeMobileMenu}
                >
                  {NAV_LINKS[0].label}
                </Link>
                <button
                  aria-label="Close menu"
                  className="flex h-10 min-h-[44px] min-w-10 shrink-0 items-center justify-center rounded-lg text-foreground hover:bg-surface-hover focus:outline-none focus:ring-2 focus:ring-border-focus"
                  type="button"
                  onClick={closeMobileMenu}
                >
                  <X aria-hidden className="h-6 w-6" />
                </button>
              </div>
              {NAV_LINKS.slice(1).map(({ href, label }) => (
                <Link
                  key={href}
                  className="focus:bg-surface-hover flex min-h-[44px] items-center rounded-lg px-4 py-2 text-base font-medium text-foreground hover:bg-surface-hover focus:outline-none focus:ring-2 focus:ring-border-focus"
                  href={href}
                  onClick={closeMobileMenu}
                >
                  {label}
                </Link>
              ))}
              {user && !isLoading && (
                <Link
                  className="focus:bg-surface-hover flex min-h-[44px] items-center gap-2 rounded-lg px-4 py-2 text-base font-medium text-foreground hover:bg-surface-hover focus:outline-none focus:ring-2 focus:ring-border-focus"
                  href="/auth/logout"
                  onClick={closeMobileMenu}
                >
                  <LogOut aria-hidden className="h-5 w-5" />
                  Sign out
                </Link>
              )}
            </div>
          </div>
        </>
      )}
    </nav>
  );
}
