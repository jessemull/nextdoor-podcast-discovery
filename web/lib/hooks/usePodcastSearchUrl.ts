"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

const SEARCH_DEBOUNCE_MS = 200;

export function isPodcastHomePath(pathname: string) {
  return pathname === "/" || pathname === "/podcast";
}

export function usePodcastSearchUrl() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const qFromUrl = searchParams.get("q") ?? "";
  const [inputValue, setInputValue] = useState(qFromUrl);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const syncSearchToUrl = isPodcastHomePath(pathname);

  useEffect(() => {
    setInputValue(qFromUrl);
  }, [qFromUrl]);

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

  const flushSearchToRoute = useCallback(
    (value: string) => {
      if (syncSearchToUrl) {
        updateUrl(value);
        return;
      }
      if (value.trim()) {
        router.push(`/podcast?q=${encodeURIComponent(value.trim())}`);
      }
    },
    [router, syncSearchToUrl, updateUrl]
  );

  const commitSearch = useCallback(
    (value: string) => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
        debounceRef.current = null;
      }
      flushSearchToRoute(value);
    },
    [flushSearchToRoute]
  );

  const handleClear = useCallback(() => {
    setInputValue("");
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
    if (syncSearchToUrl) {
      updateUrl("");
    }
  }, [syncSearchToUrl, updateUrl]);

  const handleSearchChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      setInputValue(value);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        flushSearchToRoute(value);
        debounceRef.current = null;
      }, SEARCH_DEBOUNCE_MS);
    },
    [flushSearchToRoute]
  );

  return {
    commitSearch,
    handleClear,
    handleSearchChange,
    inputValue,
    qFromUrl,
    updateUrl,
  };
}
