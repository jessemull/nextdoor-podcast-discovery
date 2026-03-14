"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

interface EpisodeRow {
  id: string;
  slug: string;
  title: string;
  status: string;
  published_at: string | null;
  created_at: string;
}

export default function AdminEpisodesPage() {
  const [episodes, setEpisodes] = useState<EpisodeRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

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

  return (
    <main className="h-full overflow-auto px-6 py-6 sm:px-8 sm:py-8">
      <div className="mx-auto max-w-3xl">
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
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-foreground text-xl font-semibold tracking-wide">
            Episode list
          </h2>
          <Link href="/admin/episodes/new">
            <Button variant="primary">New Episode</Button>
          </Link>
        </div>
        {loading ? (
          <div className="overflow-x-auto">
            <table className="border-border w-full border-collapse border text-sm">
              <thead>
                <tr className="bg-surface-hover">
                  <th className="text-foreground border-border border p-2 text-left text-xs font-semibold uppercase tracking-wide">
                    Title
                  </th>
                  <th className="text-foreground border-border border p-2 text-left text-xs font-semibold uppercase tracking-wide">
                    Slug
                  </th>
                  <th className="text-foreground border-border border p-2 text-left text-xs font-semibold uppercase tracking-wide">
                    Status
                  </th>
                  <th className="text-foreground border-border border p-2 text-left text-xs font-semibold uppercase tracking-wide">
                    Published
                  </th>
                  <th className="text-foreground border-border border p-2 text-left text-xs font-semibold uppercase tracking-wide">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {[1, 2, 3, 4, 5].map((i) => (
                  <tr key={i} className="border-border border-t">
                    <td className="border-border border p-2">
                      <div className="h-4 w-32 animate-pulse rounded bg-surface-hover" />
                    </td>
                    <td className="border-border border p-2">
                      <div className="bg-surface-hover h-3 w-20 animate-pulse rounded font-mono" />
                    </td>
                    <td className="border-border border p-2">
                      <div className="bg-surface-hover h-4 w-14 animate-pulse rounded" />
                    </td>
                    <td className="border-border border p-2">
                      <div className="bg-surface-hover h-3 w-16 animate-pulse rounded" />
                    </td>
                    <td className="border-border border p-2">
                      <div className="bg-surface-hover mx-auto h-4 w-10 animate-pulse rounded" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : episodes.length === 0 ? (
          <p className="text-muted text-sm">No episodes yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="border-border w-full border-collapse border text-sm">
              <thead>
                <tr className="bg-surface-hover">
                  <th className="text-foreground border-border border p-2 text-left text-xs font-semibold uppercase tracking-wide">
                    Title
                  </th>
                  <th className="text-foreground border-border border p-2 text-left text-xs font-semibold uppercase tracking-wide">
                    Slug
                  </th>
                  <th className="text-foreground border-border border p-2 text-left text-xs font-semibold uppercase tracking-wide">
                    Status
                  </th>
                  <th className="text-foreground border-border border p-2 text-left text-xs font-semibold uppercase tracking-wide">
                    Published
                  </th>
                  <th className="text-foreground border-border border p-2 text-left text-xs font-semibold uppercase tracking-wide">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {episodes.map((ep) => (
                  <tr key={ep.id} className="border-border border-t">
                    <td className="border-border border p-2 text-foreground" style={labelStyle}>
                      {ep.title}
                    </td>
                    <td className="border-border border p-2 font-mono text-muted text-xs">
                      {ep.slug}
                    </td>
                    <td className="border-border border p-2 text-foreground" style={labelStyle}>
                      {ep.status}
                    </td>
                    <td className="border-border border p-2 text-muted text-xs">
                      {ep.published_at
                        ? new Date(ep.published_at).toLocaleDateString()
                        : "—"}
                    </td>
                    <td className="border-border border p-2">
                      <Link
                        className="text-foreground hover:underline"
                        href={`/admin/episodes/${ep.id}/edit`}
                      >
                        Edit
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        </Card>
      </div>
    </main>
  );
}
