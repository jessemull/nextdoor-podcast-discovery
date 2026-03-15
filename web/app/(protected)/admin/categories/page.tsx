"use client";

import { MoreHorizontal, MoreVertical, Pencil, Trash2 } from "lucide-react";
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

interface Category {
  description: string | null;
  id: string;
  name: string;
  slug: string;
}

export default function AdminCategoriesPage() {
  const { toast } = useToast();
  const [categories, setCategories] = useState<Category[]>([]);
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
  const [isMd, setIsMd] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

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
      setMenuPosition({
        bottom: rect.bottom,
        left: rect.left,
        right: rect.right,
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

  const handleDeleteConfirm = useCallback(async () => {
    if (!deleteModalCategoryId) return;
    try {
      const res = await fetch(
        `/api/admin/podcast/categories/${deleteModalCategoryId}`,
        { method: "DELETE" }
      );
      if (res.ok) {
        setCategories((prev) =>
          prev.filter((c) => c.id !== deleteModalCategoryId)
        );
        setDeleteModalCategoryId(null);
        toast.success("Category deleted.");
      } else {
        const j = await res.json().catch(() => ({}));
        toast.error(j.error ?? "Delete failed");
        setDeleteModalCategoryId(null);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Delete failed");
      setDeleteModalCategoryId(null);
    }
  }, [deleteModalCategoryId, toast]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/podcast/categories");
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setError(j.error ?? res.statusText);
        setCategories([]);
        return;
      }
      const { data } = await res.json();
      setCategories(data ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
      setCategories([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

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
    <main className="h-full overflow-auto px-6 py-6 sm:px-8 sm:py-8">
      <div className="mx-auto max-w-4xl">
        <h1 className="text-foreground mb-2 text-2xl font-semibold tracking-wide">
          Categories
        </h1>
        <p className="text-foreground mb-6 text-sm" style={labelStyle}>
          Add and edit categories for browsing episodes on the public site.
        </p>
        {error && (
          <p className="text-destructive mb-4 text-sm">{error}</p>
        )}
        <Card className="mb-8 p-6">
          <div className="mb-6 flex items-center justify-between">
            <h2 className="text-foreground text-xl font-semibold tracking-wide">
              All Categories
            </h2>
            <Link href="/admin/categories/new">
              <Button variant="primary">New Category</Button>
            </Link>
          </div>
          {loading ? (
            <>
              <div className="flex flex-col gap-3 md:hidden">
                {[1, 2, 3, 4].map((i) => (
                  <div
                    key={i}
                    className="border-border flex items-start justify-between gap-3 rounded-lg border p-4"
                  >
                    <div className="min-w-0 flex-1 space-y-3">
                      <div>
                        <div className="bg-surface-hover mb-1 h-3 w-12 animate-pulse rounded" />
                        <div className="bg-surface-hover h-4 w-24 animate-pulse rounded" />
                      </div>
                      <div>
                        <div className="bg-surface-hover mb-1 h-3 w-20 animate-pulse rounded" />
                        <div className="bg-surface-hover h-3 max-w-full animate-pulse rounded" />
                      </div>
                      <div>
                        <div className="bg-surface-hover mb-1 h-3 w-10 animate-pulse rounded" />
                        <div className="bg-surface-hover h-3 w-20 animate-pulse rounded font-mono" />
                      </div>
                    </div>
                    <div className="bg-surface-hover h-8 w-8 shrink-0 animate-pulse rounded" />
                  </div>
                ))}
              </div>
              <div className="hidden md:block">
                <div className="border-border overflow-x-auto rounded-lg border">
                  <table className="border-border w-full table-fixed border-collapse border text-sm">
                    <thead>
                      <tr className="bg-surface-hover">
                        <th className="text-foreground border-border w-40 border px-4 py-3 text-left text-sm font-semibold uppercase tracking-wide">
                          Name
                        </th>
                        <th className="text-foreground border-border border px-4 py-3 text-left text-sm font-semibold uppercase tracking-wide">
                          Description
                        </th>
                        <th className="text-foreground border-border w-32 border px-4 py-3 text-left text-sm font-semibold uppercase tracking-wide">
                          Slug
                        </th>
                        <th className="border-border w-12 border px-1 py-3 text-center">
                          <span className="sr-only">Actions</span>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {[1, 2, 3, 4].map((i) => (
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
            <p className="text-muted text-sm">No categories yet.</p>
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
                        <div
                          className="text-foreground text-sm"
                          style={labelStyle}
                        >
                          {truncateCell(cat.name)}
                        </div>
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
              <div className="hidden md:block">
                <div className="border-border overflow-x-auto rounded-lg border">
                  <table className="border-border w-full table-fixed border-collapse border text-sm">
                    <thead>
                      <tr className="bg-surface-hover">
                        <th className="text-foreground border-border w-40 border px-4 py-3 text-left text-sm font-semibold uppercase tracking-wide">
                          Name
                        </th>
                        <th className="text-foreground border-border border px-4 py-3 text-left text-sm font-semibold uppercase tracking-wide">
                          Description
                        </th>
                        <th className="text-foreground border-border w-32 border px-4 py-3 text-left text-sm font-semibold uppercase tracking-wide">
                          Slug
                        </th>
                        <th className="border-border w-12 border px-1 py-3 text-center">
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
                            {truncateCell(cat.name)}
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
            </>
          )}
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
