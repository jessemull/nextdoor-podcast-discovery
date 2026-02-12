"use client";

import { useEffect, useState } from "react";

/**
 * Displays the name of the active weight configuration.
 * Shown in the feed section to indicate how posts are ranked.
 */
export function ActiveConfigBadge() {
  const [activeName, setActiveName] = useState<null | string>(null);

  useEffect(() => {
    fetch("/api/admin/weight-configs")
      .then((res) => (res.ok ? res.json() : { active_config_id: null, data: [] }))
      .then((json) => {
        const active = (json.data || []).find(
          (c: { id: string; is_active: boolean }) => c.is_active
        );
        setActiveName(active?.name || "Default");
      })
      .catch(() => setActiveName(null));
  }, []);

  if (!activeName) return null;

  return (
    <span className="rounded border border-border bg-surface-hover px-2 py-0.5 text-muted text-xs">
      Ranked by: {activeName}
    </span>
  );
}
