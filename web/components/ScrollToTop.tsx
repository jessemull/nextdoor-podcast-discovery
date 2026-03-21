"use client";

import { ChevronUp } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

/** Show after scrolling past the header area (main scroll container; header is inside main). */
const SCROLL_THRESHOLD = 140;

function getScrollContainer(): Element | null {
  if (typeof document === "undefined") return null;
  const mainScroll = document.querySelector(".podcast-main-scroll");
  if (mainScroll) return mainScroll;
  const podcastSite = document.querySelector(".podcast-site");
  if (podcastSite) return podcastSite;
  return document.documentElement;
}

export function ScrollToTop() {
  const [visible, setVisible] = useState(false);

  const checkScroll = useCallback(() => {
    const el = getScrollContainer();
    if (!el) return;
    const top =
      el === document.documentElement
        ? window.scrollY
        : (el as HTMLElement).scrollTop;
    setVisible(top > SCROLL_THRESHOLD);
  }, []);

  useEffect(() => {
    queueMicrotask(() => checkScroll());
    const el = getScrollContainer();
    if (!el) return;
    const target = el === document.documentElement ? window : el;
    target.addEventListener("scroll", checkScroll, { passive: true });
    return () => target.removeEventListener("scroll", checkScroll);
  }, [checkScroll]);

  const scrollToTop = useCallback(() => {
    const el = getScrollContainer();
    if (!el) return;
    if (el === document.documentElement) {
      window.scrollTo({ behavior: "smooth", top: 0 });
    } else {
      el.scrollTo({ behavior: "smooth", top: 0 });
    }
  }, []);

  if (!visible) return null;

  return (
    <button
      aria-label="Scroll to top"
      className="bg-podcast-accent fixed bottom-6 right-6 z-50 flex h-12 w-12 items-center justify-center rounded-full text-[#31484E] shadow-lg transition-opacity hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-podcast-accent focus:ring-offset-2 focus:ring-offset-[var(--background)]"
      type="button"
      onClick={scrollToTop}
    >
      <ChevronUp aria-hidden className="h-6 w-6" />
    </button>
  );
}
