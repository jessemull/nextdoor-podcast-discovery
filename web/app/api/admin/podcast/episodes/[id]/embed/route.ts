import { NextResponse } from "next/server";

import { computeAndUpsertEpisodeEmbedding } from "@/lib/episode-embedding.server";
import { getSession } from "@/lib/supabase-server-auth";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/admin/podcast/episodes/[id]/embed
 * Generate embedding for episode (title + description + show_notes) and upsert into episode_embeddings.
 * Used for "Related episodes" similarity. Auth required.
 * Normally embeddings are updated automatically on save; this endpoint allows manual refresh.
 */
export async function POST(request: Request, { params }: RouteParams) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id: episodeId } = await params;

  try {
    await computeAndUpsertEpisodeEmbedding(episodeId);
    return NextResponse.json({ data: { ok: true } });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to compute embedding";
    const status =
      message === "Episode not found"
        ? 404
        : message === "Episode has no title, description, or show notes to embed"
          ? 400
          : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
