"use client";

import { useEffect, useRef, useState } from "react";

export interface UseFeedKeyboardNavOptions {
  onOpenPost: (postId: string) => void;
  posts: Array<{ id: string }>;
}

export interface UseFeedKeyboardNavResult {
  focusedIndex: number;
  postRefs: React.MutableRefObject<(HTMLDivElement | null)[]>;
  sentinelRef: React.RefObject<HTMLDivElement | null>;
  setFocusedIndex: React.Dispatch<React.SetStateAction<number>>;
}

/**
 * Keyboard navigation for the feed: J/K and ArrowDown/Up move focus,
 * Enter opens the focused post. Scrolls focused item into view.
 * Listens to keydown on window so focus works from anywhere in the feed.
 */
export function useFeedKeyboardNav({
  onOpenPost,
  posts,
}: UseFeedKeyboardNavOptions): UseFeedKeyboardNavResult {
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const focusedIndexRef = useRef(-1);
  const postRefs = useRef<(HTMLDivElement | null)[]>([]);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  focusedIndexRef.current = focusedIndex;

  const onOpenPostRef = useRef(onOpenPost);
  onOpenPostRef.current = onOpenPost;

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.tagName === "SELECT" ||
        target.isContentEditable
      ) {
        return;
      }
      if (posts.length === 0) return;
      const key = e.key.toLowerCase();
      if (key === "j" || key === "arrowdown") {
        e.preventDefault();
        setFocusedIndex((prev) =>
          prev < posts.length - 1 ? prev + 1 : prev
        );
      } else if (key === "k" || key === "arrowup") {
        e.preventDefault();
        setFocusedIndex((prev) => (prev <= 0 ? 0 : prev - 1));
      } else if (key === "enter") {
        const current = focusedIndexRef.current;
        if (current >= 0 && posts[current]) {
          e.preventDefault();
          onOpenPostRef.current(posts[current].id);
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [posts]);

  // Clamp focused index when posts change
  useEffect(() => {
    if (posts.length === 0) setFocusedIndex(-1);
    else if (focusedIndex >= posts.length) setFocusedIndex(posts.length - 1);
  }, [focusedIndex, posts.length]);

  // Scroll focused card into view
  useEffect(() => {
    if (focusedIndex >= 0 && postRefs.current[focusedIndex]) {
      postRefs.current[focusedIndex]?.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
      });
    }
  }, [focusedIndex]);

  return {
    focusedIndex,
    postRefs,
    sentinelRef,
    setFocusedIndex,
  };
}
