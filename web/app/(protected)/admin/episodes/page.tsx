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

interface EpisodeRow {
  created_at: string;
  id: string;
  published_at: string | null;
  slug: string;
  status: string;
  title: string;
}

function formatStatus(status: string): string {
  if (status === "published") return "Published";
  if (status === "draft") return "Draft";
  return status;
}

export default function AdminEpisodesPage() {
  const { toast } = useToast();
  const [deleteModalEpisodeId, setDeleteModalEpisodeId] = useState<
    null | string
  >(null);
  const [episodes, setEpisodes] = useState<EpisodeRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [menuOpenEpisodeId, setMenuOpenEpisodeId] = useState<null | string>(
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
    if (menuOpenEpisodeId == null) return;
    const rect = menuRef.current?.getBoundingClientRect();
    if (rect) {
      setMenuPosition({
        bottom: rect.bottom,
        left: rect.left,
        right: rect.right,
      });
    }
  }, [menuOpenEpisodeId]);

  useEffect(() => {
    if (menuOpenEpisodeId == null) return;
    const handleClick = (e: MouseEvent) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(e.target as Node)
      ) {
        const target = e.target as HTMLElement;
        if (!target.closest("[data-episode-actions-menu]")) {
          setMenuOpenEpisodeId(null);
          setMenuPosition(null);
        }
      }
    };
    document.addEventListener("click", handleClick, true);
    return () => document.removeEventListener("click", handleClick, true);
  }, [menuOpenEpisodeId]);

  const handleDeleteConfirm = useCallback(async () => {
    if (!deleteModalEpisodeId) return;
    try {
      const res = await fetch(
        `/api/admin/podcast/episodes/${deleteModalEpisodeId}`,
        { method: "DELETE" }
      );
      if (res.ok) {
        setEpisodes((prev) =>
          prev.filter((e) => e.id !== deleteModalEpisodeId)
        );
        setDeleteModalEpisodeId(null);
        toast.success("Episode deleted.");
      } else {
        const j = await res.json().catch(() => ({}));
        toast.error(j.error ?? "Delete failed");
        setDeleteModalEpisodeId(null);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Delete failed");
      setDeleteModalEpisodeId(null);
    }
  }, [deleteModalEpisodeId, toast]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/podcast/episodes");
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setError(j.error ?? res.statusText);
        setEpisodes([]);
        return;
      }
      const { data } = await res.json();
      setEpisodes(data ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
      setEpisodes([]);
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
          Episodes
        </h1>
        <p className="text-foreground mb-6 text-sm" style={labelStyle}>
          Create, edit, and delete podcast episodes.
        </p>
        {error && (
          <p className="text-destructive mb-4 text-sm">{error}</p>
        )}
        <Card className="mb-8 p-6">
          <div className="mb-6 flex items-center justify-between">
            <h2 className="text-foreground text-xl font-semibold tracking-wide">
              Episode list
            </h2>
            <Link href="/admin/episodes/new">
              <Button variant="primary">New Episode</Button>
            </Link>
          </div>
          {loading ? (
            <>
              <div className="flex flex-col gap-3 md:hidden">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div
                    className="border-border flex items-start justify-between gap-3 rounded-lg border p-4"
                    key={i}
                  >
                    <div className="min-w-0 flex-1 space-y-3">
                      <div>
                        <div className="bg-surface-hover mb-1 h-3 w-12 animate-pulse rounded" />
                        <div className="bg-surface-hover h-4 w-32 animate-pulse rounded" />
                      </div>
                      <div>
                        <div className="bg-surface-hover mb-1 h-3 w-10 animate-pulse rounded" />
                        <div className="bg-surface-hover h-3 w-24 animate-pulse rounded font-mono" />
                      </div>
                      <div>
                        <div className="bg-surface-hover mb-1 h-3 w-14 animate-pulse rounded" />
                        <div className="bg-surface-hover h-3 w-16 animate-pulse rounded" />
                      </div>
                      <div>
                        <div className="bg-surface-hover mb-1 h-3 w-20 animate-pulse rounded" />
                        <div className="bg-surface-hover h-3 w-20 animate-pulse rounded" />
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
                        <th className="text-foreground border-border border px-4 py-3 text-left text-sm font-semibold uppercase tracking-wide">
                          Title
                        </th>
                        <th className="text-foreground border-border w-32 border px-4 py-3 text-left text-sm font-semibold uppercase tracking-wide">
                          Slug
                        </th>
                        <th className="text-foreground border-border w-24 border px-4 py-3 text-left text-sm font-semibold uppercase tracking-wide">
                          Status
                        </th>
                        <th className="text-foreground border-border w-24 border px-4 py-3 text-left text-sm font-semibold uppercase tracking-wide">
                          Published
                        </th>
                        <th className="border-border w-12 border px-1 py-3 text-center">
                          <span className="sr-only">Actions</span>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {[1, 2, 3, 4, 5].map((i) => (
                        <tr className="border-border border-t h-12" key={i}>
                          <td className="border-border border px-4 py-3">
                            <div className="bg-surface-hover h-4 w-32 animate-pulse rounded" />
                          </td>
                          <td className="border-border w-32 border px-4 py-3">
                            <div className="bg-surface-hover h-4 w-20 animate-pulse rounded font-mono" />
                          </td>
                          <td className="border-border w-24 border px-4 py-3">
                            <div className="bg-surface-hover h-4 w-14 animate-pulse rounded" />
                          </td>
                          <td className="border-border w-24 border px-4 py-3">
                            <div className="bg-surface-hover h-4 w-16 animate-pulse rounded" />
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
          ) : episodes.length === 0 ? (
            <p className="text-muted text-sm">No episodes yet.</p>
          ) : (
            <>
              <div className="flex flex-col gap-3 md:hidden">
                {episodes.map((ep) => (
                  <div
                    className="border-border flex items-start justify-between gap-3 rounded-lg border p-4"
                    key={ep.id}
                  >
                    <div className="min-w-0 flex-1 space-y-3">
                      <div>
                        <h4 className="text-foreground mb-1 text-xs font-semibold uppercase tracking-wide">
                          Title
                        </h4>
                        <div
                          className="text-foreground text-sm"
                          style={labelStyle}
                        >
                          {truncateCell(ep.title)}
                        </div>
                      </div>
                      <div>
                        <h4 className="text-foreground mb-1 text-xs font-semibold uppercase tracking-wide">
                          Slug
                        </h4>
                        <div
                          className="text-muted font-mono text-xs"
                          style={labelStyle}
                        >
                          {truncateCell(ep.slug)}
                        </div>
                      </div>
                      <div>
                        <h4 className="text-foreground mb-1 text-xs font-semibold uppercase tracking-wide">
                          Status
                        </h4>
                        <p
                          className="text-muted text-sm"
                          style={labelStyle}
                        >
                          {formatStatus(ep.status)}
                        </p>
                      </div>
                      <div>
                        <h4 className="text-foreground mb-1 text-xs font-semibold uppercase tracking-wide">
                          Published
                        </h4>
                        <p
                          className="text-muted text-sm"
                          style={labelStyle}
                        >
                          {ep.published_at
                            ? new Date(ep.published_at).toLocaleDateString()
                            : "—"}
                        </p>
                      </div>
                    </div>
                    <div
                      className="relative shrink-0"
                      ref={
                        !isMd && menuOpenEpisodeId === ep.id
                          ? menuRef
                          : null
                      }
                    >
                      <button
                        aria-expanded={menuOpenEpisodeId === ep.id}
                        aria-haspopup="menu"
                        aria-label="Actions"
                        className="flex cursor-pointer items-center justify-center rounded p-1.5 focus:outline-none focus:ring-2 focus:ring-border-focus"
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setMenuOpenEpisodeId((id) =>
                            id === ep.id ? null : ep.id
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
                        <th className="text-foreground border-border border px-4 py-3 text-left text-sm font-semibold uppercase tracking-wide">
                          Title
                        </th>
                        <th className="text-foreground border-border w-32 border px-4 py-3 text-left text-sm font-semibold uppercase tracking-wide">
                          Slug
                        </th>
                        <th className="text-foreground border-border w-24 border px-4 py-3 text-left text-sm font-semibold uppercase tracking-wide">
                          Status
                        </th>
                        <th className="text-foreground border-border w-24 border px-4 py-3 text-left text-sm font-semibold uppercase tracking-wide">
                          Published
                        </th>
                        <th className="border-border w-12 border px-1 py-3 text-center">
                          <span className="sr-only">Actions</span>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {episodes.map((ep) => (
                        <tr className="border-border border-t h-12" key={ep.id}>
                          <td
                            className="text-foreground border-border border px-4 py-3"
                            style={labelStyle}
                          >
                            {truncateCell(ep.title)}
                          </td>
                          <td
                            className="text-muted border-border w-32 border px-4 py-3 font-mono"
                            style={labelStyle}
                          >
                            {truncateCell(ep.slug)}
                          </td>
                          <td
                            className="text-muted border-border w-24 border px-4 py-3"
                            style={labelStyle}
                          >
                            {formatStatus(ep.status)}
                          </td>
                          <td
                            className="text-muted border-border w-24 border px-4 py-3"
                            style={labelStyle}
                          >
                            {ep.published_at
                              ? new Date(ep.published_at).toLocaleDateString()
                              : "—"}
                          </td>
                          <td className="border-border w-12 border px-1 py-3 text-center">
                            <div
                              className="relative inline-block"
                              ref={
                                isMd && menuOpenEpisodeId === ep.id
                                  ? menuRef
                                  : null
                              }
                            >
                              <button
                                aria-expanded={menuOpenEpisodeId === ep.id}
                                aria-haspopup="menu"
                                aria-label="Actions"
                                className="flex cursor-pointer items-center justify-center rounded p-1.5 focus:outline-none focus:ring-2 focus:ring-border-focus"
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setMenuOpenEpisodeId((id) =>
                                    id === ep.id ? null : ep.id
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
          menuOpenEpisodeId !== null &&
          menuPosition !== null &&
          (() => {
            const openEpisode = episodes.find(
              (e) => e.id === menuOpenEpisodeId
            );
            if (!openEpisode) return null;
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
                data-episode-actions-menu
                role="menu"
                style={{
                  left,
                  position: "fixed",
                  top: menuPosition.bottom + 4,
                }}
              >
                <Link
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-foreground hover:bg-surface-hover"
                  href={`/admin/episodes/${openEpisode.id}/edit`}
                  role="menuitem"
                  onClick={() => {
                    setMenuOpenEpisodeId(null);
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
                    setMenuOpenEpisodeId(null);
                    setMenuPosition(null);
                    setDeleteModalEpisodeId(openEpisode.id);
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
          message="Are you sure you want to delete this episode? This cannot be undone."
          open={deleteModalEpisodeId !== null}
          title="Delete Episode"
          onCancel={() => setDeleteModalEpisodeId(null)}
          onConfirm={handleDeleteConfirm}
        />
      </div>
    </main>
  );
}
