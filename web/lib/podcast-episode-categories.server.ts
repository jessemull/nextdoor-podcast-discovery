/**
 * Admin persistence for episode_categories (episode ↔ podcast_categories).
 */

import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type ParseCategoryIdsResult =
  | { ids: string[]; kind: "ok" }
  | { kind: "absent" }
  | { kind: "error"; message: string };

/**
 * Reads category_ids from a JSON body. Absent key → absent (caller skips update).
 * Present key → must be an array of UUID strings (deduped).
 */
export function parseCategoryIds(
  body: Record<string, unknown>
): ParseCategoryIdsResult {
  if (!Object.prototype.hasOwnProperty.call(body, "category_ids")) {
    return { kind: "absent" };
  }
  const raw = body.category_ids;
  if (!Array.isArray(raw)) {
    return { kind: "error", message: "category_ids must be an array" };
  }
  const seen = new Set<string>();
  for (const item of raw) {
    if (typeof item !== "string") {
      return {
        kind: "error",
        message: "category_ids must contain only string UUIDs",
      };
    }
    const t = item.trim();
    if (!UUID_RE.test(t)) {
      return { kind: "error", message: `Invalid category id: ${item}` };
    }
    seen.add(t);
  }
  return { kind: "ok", ids: [...seen] };
}

/**
 * Replaces all category links for an episode. Validates ids exist in podcast_categories.
 */
export async function replaceEpisodeCategories(
  supabase: SupabaseClient,
  episodeId: string,
  categoryIds: string[]
): Promise<void> {
  const { error: delErr } = await supabase
    .from("episode_categories")
    .delete()
    .eq("episode_id", episodeId);

  if (delErr) {
    throw new Error(delErr.message);
  }

  if (categoryIds.length === 0) {
    return;
  }

  const { data: existing, error: selErr } = await supabase
    .from("podcast_categories")
    .select("id")
    .in("id", categoryIds);

  if (selErr) {
    throw new Error(selErr.message);
  }

  const found = new Set((existing ?? []).map((r) => r.id as string));
  const missing = categoryIds.filter((id) => !found.has(id));
  if (missing.length > 0) {
    throw new Error(
      `Unknown category id(s): ${missing.slice(0, 3).join(", ")}${
        missing.length > 3 ? "…" : ""
      }`
    );
  }

  const rows = categoryIds.map((category_id) => ({
    category_id,
    episode_id: episodeId,
  }));

  const { error: insErr } = await supabase.from("episode_categories").insert(rows);

  if (insErr) {
    throw new Error(insErr.message);
  }
}
