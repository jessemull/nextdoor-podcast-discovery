"use client";

import {
  MoreHorizontal,
  MoreVertical,
  Pencil,
  Search,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import {
  Tooltip,
  TooltipContent,
  TooltipPortal,
  TooltipTrigger,
} from "@/components/ui/Tooltip";
import { useToast } from "@/lib/ToastContext";

interface CategoryRow {
  description: string | null;
  id: string;
  name: string;
  slug: string;
}

const CATEGORIES_PAGE_SIZE = 10;
const SEARCH_DEBOUNCE_MS = 300;

export default function AdminCategoriesPage() {
  const { toast } = useToast();
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [deleteModalCategoryId, setDeleteModalCategoryId] = useState<
    null | string
  >(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [menuOpenCategoryId, setMenuOpenCategoryId] = useState<null | string>(
    null
  );
  const [menuPosition, setMenuPosition] = useState<{
    bottom: number;
    left: number;
    right: number;
  } | null>(null);
  const [offset, setOffset] = useState(0);
  const [searchParam, setSearchParam] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [total, setTotal] = useState(0);
  const [isMd, setIsMd] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const categoriesLengthRef = useRef(0);
  const loadMoreSentinelRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const mql = window.matchMedia("(min-width: 768px)");
    const handler = () => setIsMd(mql.matches);
    handler();
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, []);

  useEffect(() => {
    if (menuOpenCategoryId == null) return;
    const rect = menuRef.current?.getBoundingClientRect();
    if (rect) {
      queueMicrotask(() => {
        setMenuPosition({
          bottom: rect.bottom,
          left: rect.left,
          right: rect.right,
        });
      });
    }
  }, [menuOpenCategoryId]);

  useEffect(() => {
    if (menuOpenCategoryId == null) return;
    const handleClick = (e: MouseEvent) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(e.target as Node)
      ) {
        const target = e.target as HTMLElement;
        if (!target.closest("[data-category-actions-menu]")) {
          setMenuOpenCategoryId(null);
          setMenuPosition(null);
        }
      }
    };
    document.addEventListener("click", handleClick, true);
    return () => document.removeEventListener("click", handleClick, true);
  }, [menuOpenCategoryId]);

  const load = useCallback(
    async (search: string, pageOffset: number, append: boolean = false) => {
      if (!append) {
        setLoading(true);
        setError(null);
      } else {
        setLoadingMore(true);
      }
      try {
        const params = new URLSearchParams();
        params.set("limit", String(CATEGORIES_PAGE_SIZE));
        params.set("offset", String(pageOffset));
        if (search.trim()) params.set("search", search.trim());
        const res = await fetch(
          `/api/admin/podcast/categories?${params.toString()}`
        );
        if (!res.ok) {
          const j = await res.json().catch(() => ({}));
          setError(j.error ?? res.statusText);
          if (!append) {
            setCategories([]);
            setTotal(0);
            setLoading(false);
          } else {
            setLoadingMore(false);
          }
          return;
        }
        const j = await res.json();
        const list = j.data ?? [];
        const totalFromApi = typeof j.total === "number" ? j.total : 0;
        if (append) {
          setCategories((prev) => [...prev, ...list]);
          setLoadingMore(false);
        } else {
          setCategories(list);
          setTotal(totalFromApi);
          setLoading(false);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load");
        if (!append) {
          setCategories([]);
          setTotal(0);
          setLoading(false);
        } else {
          setLoadingMore(false);
        }
      }
    },
    []
  );

  useEffect(() => {
    queueMicrotask(() => {
      void load(searchParam, isMd ? offset : 0, false);
    });
  }, [load, searchParam, isMd, offset]);

  useEffect(() => {
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    const q = searchQuery.trim();
    if (q === "") {
      queueMicrotask(() => {
        setSearchParam("");
        setOffset(0);
      });
      return;
    }
    searchDebounceRef.current = setTimeout(() => {
      searchDebounceRef.current = null;
      setSearchParam(q);
      setOffset(0);
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    };
  }, [searchQuery]);

  const handleSearchChange = useCallback((value: string) => {
    setSearchQuery(value);
  }, []);

  const goToPage = useCallback((newOffset: number) => {
    setOffset((prev) => Math.max(0, newOffset));
  }, []);

  useEffect(() => {
    categoriesLengthRef.current = categories.length;
  }, [categories.length]);

  const loadMore = useCallback(() => {
    if (isMd || loading || loadingMore) return;
    const nextOffset = categoriesLengthRef.current;
    if (nextOffset >= total) return;
    void load(searchParam, nextOffset, true);
  }, [isMd, load, loading, loadingMore, searchParam, total]);

  useEffect(() => {
    if (isMd || total === 0 || categories.length >= total) return;
    const sentinel = loadMoreSentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && !loading && !loadingMore)
          loadMore();
      },
      { rootMargin: "200px", threshold: 0 }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [isMd, categories.length, total, loading, loadingMore, loadMore]);

  const handleDeleteConfirm = useCallback(async () => {
    if (!deleteModalCategoryId) return;
    try {
      const res = await fetch(
        `/api/admin/podcast/categories/${deleteModalCategoryId}`,
        { method: "DELETE" }
      );
      if (res.ok) {
        setDeleteModalCategoryId(null);
        toast.success("Category deleted.");
        void load(searchParam, isMd ? offset : 0, false);
      } else {
        const j = await res.json().catch(() => ({}));
        toast.error(j.error ?? "Delete failed");
        setDeleteModalCategoryId(null);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Delete failed");
      setDeleteModalCategoryId(null);
    }
  }, [deleteModalCategoryId, isMd, load, offset, searchParam, toast]);

  const labelStyle = { opacity: 0.85 };

  const truncateCell = (text: string, className = "") => (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className={`block min-w-0 overflow-hidden text-ellipsis whitespace-nowrap ${className}`}
        >
          {text}
        </span>
      </TooltipTrigger>
      <TooltipPortal>
        <TooltipContent side="top">{text}</TooltipContent>
      </TooltipPortal>
    </Tooltip>
  );

  return (
    <main className="px-6 py-6 sm:px-8 sm:py-8">
      <div className="mx-auto max-w-4xl">
        <h1 className="text-foreground mb-2 text-2xl font-semibold tracking-wide">
          Categories
        </h1>
        <p className="text-foreground mb-6 text-sm" style={labelStyle}>
          Add and edit topic tags; each appears as a chip on episodes and links to related episodes.
        </p>
        {error && (
          <p className="text-destructive mb-4 text-sm">{error}</p>
        )}
        <Card className="mb-8 p-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
            <h2 className="text-foreground text-xl font-semibold tracking-wide">
              Category List
            </h2>
            <Link href="/admin/categories/new">
              <Button variant="primary">New Category</Button>
            </Link>
          </div>
          <div className="border-border mb-4 -mx-6 px-6 md:mx-0 md:mb-2 md:px-0">
            <div className="border-border text-foreground flex items-center gap-2 rounded-lg border border-b-0 bg-background px-3 py-2 focus-within:ring-2 focus-within:ring-border-focus md:border-b">
              <Search
                aria-hidden
                className="text-muted h-4 w-4 shrink-0"
              />
              <input
                aria-label="Search categories"
                className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted"
                placeholder="Search by anything..."
                type="search"
                value={searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
              />
            </div>
          </div>
          <div className="min-h-0 max-h-[calc(100dvh-260px)] overflow-y-auto md:max-h-none md:overflow-visible">
          {loading ? (
            <>
              <div className="flex flex-col gap-3 md:hidden">
                {Array.from(
                  { length: CATEGORIES_PAGE_SIZE },
                  (_, i) => i
                ).map((i) => (
                  <div
                    key={i}
                    className="border-border flex items-start justify-between gap-3 rounded-lg border p-4"
                  >
                    <div className="min-w-0 flex-1 space-y-3">
                      <div>
                        <div className="bg-surface-hover mb-1 h-3 w-12 animate-pulse rounded" />
                        <div className="bg-surface-hover h-4 w-32 animate-pulse rounded" />
                      </div>
                      <div>
                        <div className="bg-surface-hover mb-1 h-3 w-20 animate-pulse rounded" />
                        <div className="bg-surface-hover h-3 max-w-full animate-pulse rounded" />
                      </div>
                      <div>
                        <div className="bg-surface-hover mb-1 h-3 w-10 animate-pulse rounded" />
                        <div className="bg-surface-hover h-3 w-24 animate-pulse rounded font-mono" />
                      </div>
                    </div>
                    <div className="bg-surface-hover h-8 w-8 shrink-0 animate-pulse rounded" />
                  </div>
                ))}
              </div>
              <div className="hidden md:block">
                <div className="border-border max-h-[27rem] overflow-y-auto rounded-lg border">
                  <table className="border-border w-full table-fixed border-separate border-spacing-0 border text-sm">
                    <thead>
                      <tr>
                        <th className="text-foreground border-border sticky top-0 z-10 w-40 border bg-surface-hover px-4 py-3 text-left text-sm font-semibold uppercase tracking-wide">
                          Name
                        </th>
                        <th className="text-foreground border-border sticky top-0 z-10 border bg-surface-hover px-4 py-3 text-left text-sm font-semibold uppercase tracking-wide">
                          Description
                        </th>
                        <th className="text-foreground border-border sticky top-0 z-10 w-32 border bg-surface-hover px-4 py-3 text-left text-sm font-semibold uppercase tracking-wide">
                          Slug
                        </th>
                        <th className="border-border sticky top-0 z-10 w-12 border bg-surface-hover px-1 py-3 text-center">
                          <span className="sr-only">Actions</span>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {Array.from(
                        { length: CATEGORIES_PAGE_SIZE },
                        (_, i) => i
                      ).map((i) => (
                        <tr key={i} className="border-border border-t h-12">
                          <td className="border-border border px-4 py-3">
                            <div className="bg-surface-hover h-4 w-24 animate-pulse rounded" />
                          </td>
                          <td className="border-border border px-4 py-3">
                            <div className="bg-surface-hover h-4 max-w-xs animate-pulse rounded" />
                          </td>
                          <td className="border-border w-32 border px-4 py-3">
                            <div className="bg-surface-hover h-4 w-20 animate-pulse rounded font-mono" />
                          </td>
                          <td className="border-border w-12 border px-1 py-3 text-center">
                            <div className="bg-surface-hover mx-auto h-4 w-8 animate-pulse rounded" />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          ) : categories.length === 0 ? (
            <p className="text-muted text-sm">
              {searchParam
                ? "No categories found. Try a different search."
                : "No categories yet."}
            </p>
          ) : (
            <>
              <div className="flex flex-col gap-3 md:hidden">
                {categories.map((cat) => (
                  <div
                    key={cat.id}
                    className="border-border flex items-start justify-between gap-3 rounded-lg border p-4"
                  >
                    <div className="min-w-0 flex-1 space-y-3">
                      <div>
                        <h4 className="text-foreground mb-1 text-xs font-semibold uppercase tracking-wide">
                          Name
                        </h4>
                        <Link
                          className="text-foreground text-sm hover:underline"
                          href={`/admin/categories/${cat.id}/edit`}
                          style={labelStyle}
                        >
                          {truncateCell(cat.name)}
                        </Link>
                      </div>
                      <div>
                        <h4 className="text-foreground mb-1 text-xs font-semibold uppercase tracking-wide">
                          Description
                        </h4>
                        {cat.description ? (
                          <div
                            className="text-muted text-sm"
                            style={labelStyle}
                          >
                            {truncateCell(cat.description)}
                          </div>
                        ) : (
                          <p className="text-muted text-sm">—</p>
                        )}
                      </div>
                      <div>
                        <h4 className="text-foreground mb-1 text-xs font-semibold uppercase tracking-wide">
                          Slug
                        </h4>
                        <div
                          className="text-muted font-mono text-xs"
                          style={labelStyle}
                        >
                          {truncateCell(cat.slug)}
                        </div>
                      </div>
                    </div>
                    <div
                      className="relative shrink-0"
                      ref={
                        !isMd && menuOpenCategoryId === cat.id
                          ? menuRef
                          : null
                      }
                    >
                      <button
                        aria-expanded={menuOpenCategoryId === cat.id}
                        aria-haspopup="menu"
                        aria-label="Actions"
                        className="flex cursor-pointer items-center justify-center rounded p-1.5 focus:outline-none focus:ring-2 focus:ring-border-focus"
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setMenuOpenCategoryId((id) =>
                            id === cat.id ? null : cat.id
                          );
                        }}
                      >
                        <MoreHorizontal
                          aria-hidden
                          className="h-4 w-4 text-foreground"
                        />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              <div
                aria-hidden
                className="h-4 md:hidden"
                ref={loadMoreSentinelRef}
              />
              {!isMd && loadingMore && (
                <p className="text-muted py-3 text-center text-sm md:hidden">
                  Loading more…
                </p>
              )}
              <div className="hidden md:block">
                <div className="border-border max-h-[27rem] overflow-y-auto rounded-lg border">
                  <table className="border-border w-full table-fixed border-separate border-spacing-0 border text-sm">
                    <thead>
                      <tr>
                        <th className="text-foreground border-border sticky top-0 z-10 w-40 border bg-surface-hover px-4 py-3 text-left text-sm font-semibold uppercase tracking-wide">
                          Name
                        </th>
                        <th className="text-foreground border-border sticky top-0 z-10 border bg-surface-hover px-4 py-3 text-left text-sm font-semibold uppercase tracking-wide">
                          Description
                        </th>
                        <th className="text-foreground border-border sticky top-0 z-10 w-32 border bg-surface-hover px-4 py-3 text-left text-sm font-semibold uppercase tracking-wide">
                          Slug
                        </th>
                        <th className="border-border sticky top-0 z-10 w-12 border bg-surface-hover px-1 py-3 text-center">
                          <span className="sr-only">Actions</span>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {categories.map((cat) => (
                        <tr key={cat.id} className="border-border border-t h-12">
                          <td
                            className="text-foreground border-border border px-4 py-3"
                            style={labelStyle}
                          >
                            <Link
                              className="hover:underline"
                              href={`/admin/categories/${cat.id}/edit`}
                            >
                              {truncateCell(cat.name)}
                            </Link>
                          </td>
                          <td
                            className="text-muted border-border border px-4 py-3"
                            style={labelStyle}
                          >
                            {cat.description
                              ? truncateCell(cat.description)
                              : "—"}
                          </td>
                          <td
                            className="text-muted border-border w-32 border px-4 py-3 font-mono"
                            style={labelStyle}
                          >
                            {truncateCell(cat.slug)}
                          </td>
                          <td className="border-border w-12 border px-1 py-3 text-center">
                            <div
                              className="relative inline-block"
                              ref={
                                isMd && menuOpenCategoryId === cat.id
                                  ? menuRef
                                  : null
                              }
                            >
                              <button
                                aria-expanded={menuOpenCategoryId === cat.id}
                                aria-haspopup="menu"
                                aria-label="Actions"
                                className="flex cursor-pointer items-center justify-center rounded p-1.5 focus:outline-none focus:ring-2 focus:ring-border-focus"
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setMenuOpenCategoryId((id) =>
                                    id === cat.id ? null : cat.id
                                  );
                                }}
                              >
                                <MoreVertical
                                  aria-hidden
                                  className="h-4 w-4 text-foreground"
                                />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              {total > 0 && (
                <div className="border-border mt-4 hidden flex-wrap items-center justify-between gap-3 border-t pt-4 md:flex">
                  <p className="text-muted text-sm">
                    Showing {offset + 1}–{offset + categories.length} of{" "}
                    {total}
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      disabled={offset === 0}
                      type="button"
                      variant="secondary"
                      onClick={() =>
                        goToPage(offset - CATEGORIES_PAGE_SIZE)
                      }
                    >
                      Previous
                    </Button>
                    <Button
                      disabled={
                        offset + categories.length >= total ||
                        categories.length < CATEGORIES_PAGE_SIZE
                      }
                      type="button"
                      variant="secondary"
                      onClick={() =>
                        goToPage(offset + CATEGORIES_PAGE_SIZE)
                      }
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
          </div>
        </Card>
        {typeof document !== "undefined" &&
          menuOpenCategoryId !== null &&
          menuPosition !== null &&
          (() => {
            const openCategory = categories.find(
              (c) => c.id === menuOpenCategoryId
            );
            if (!openCategory) return null;
            const menuWidth = 176;
            const left = Math.max(
              8,
              Math.min(
                menuPosition.right - menuWidth,
                typeof window !== "undefined"
                  ? window.innerWidth - menuWidth - 8
                  : menuPosition.right - menuWidth
              )
            );
            return createPortal(
              <div
                className="border-border bg-surface z-50 min-w-[11rem] rounded-card border py-1 shadow-lg"
                data-category-actions-menu
                role="menu"
                style={{
                  left,
                  position: "fixed",
                  top: menuPosition.bottom + 4,
                }}
              >
                <Link
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-foreground hover:bg-surface-hover"
                  href={`/admin/categories/${openCategory.id}/edit`}
                  role="menuitem"
                  onClick={() => {
                    setMenuOpenCategoryId(null);
                    setMenuPosition(null);
                  }}
                >
                  <Pencil aria-hidden className="h-4 w-4" />
                  Edit
                </Link>
                <button
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-destructive hover:bg-surface-hover"
                  role="menuitem"
                  type="button"
                  onClick={() => {
                    setMenuOpenCategoryId(null);
                    setMenuPosition(null);
                    setDeleteModalCategoryId(openCategory.id);
                  }}
                >
                  <Trash2 aria-hidden className="h-4 w-4" />
                  Delete
                </button>
              </div>,
              document.body
            );
          })()}
        <ConfirmModal
          cancelLabel="Cancel"
          confirmLabel="Delete"
          message="Are you sure you want to delete this category? This cannot be undone."
          open={deleteModalCategoryId !== null}
          title="Delete Category"
          onCancel={() => setDeleteModalCategoryId(null)}
          onConfirm={handleDeleteConfirm}
        />
      </div>
    </main>
  );
}
