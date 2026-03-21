"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

const SEARCH_DEBOUNCE_MS = 200;

export function usePodcastSearchUrl() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const qFromUrl = searchParams.get("q") ?? "";
  const [inputValue, setInputValue] = useState(qFromUrl);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  const handleClear = useCallback(() => {
    setInputValue("");
    updateUrl("");
  }, [updateUrl]);

  return {
    handleClear,
    handleSearchChange,
    inputValue,
    qFromUrl,
    updateUrl,
  };
}
