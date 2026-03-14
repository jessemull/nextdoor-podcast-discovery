import { NextResponse } from "next/server";
import OpenAI from "openai";

import { env } from "@/lib/env.server";
import { getSession } from "@/lib/supabase-server-auth";
import { getSupabaseAdmin } from "@/lib/supabase.server";

const EMBEDDING_MODEL = "text-embedding-3-small";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/admin/podcast/episodes/[id]/embed
 * Generate embedding for episode (title + description + show_notes) and upsert into episode_embeddings.
 * Used for "Related episodes" similarity. Auth required.
 */
export async function POST(request: Request, { params }: RouteParams) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id: episodeId } = await params;

  const supabase = getSupabaseAdmin();
  const { data: episode, error: fetchError } = await supabase
    .from("podcast_episodes")
    .select("id, title, description, show_notes, transcript")
    .eq("id", episodeId)
    .single();

  if (fetchError || !episode) {
    return NextResponse.json(
      { error: fetchError?.message ?? "Episode not found" },
      { status: fetchError?.code === "PGRST116" ? 404 : 500 }
    );
  }

  const parts = [
    (episode.title as string) ?? "",
    (episode.description as string) ?? "",
    (episode.show_notes as string) ?? "",
  ];
  const text = parts
    .filter(Boolean)
    .join("\n\n")
    .replace(/\s+/g, " ")
    .trim();

  if (!text) {
    return NextResponse.json(
      { error: "Episode has no title, description, or show notes to embed" },
      { status: 400 }
    );
  }

  const openaiApiKey = env.OPENAI_API_KEY;
  if (!openaiApiKey) {
    return NextResponse.json(
      { error: "OPENAI_API_KEY is not configured" },
      { status: 500 }
    );
  }

  const openai = new OpenAI({ apiKey: openaiApiKey });
  const embeddingResponse = await openai.embeddings.create({
    input: text.slice(0, 8000),
    model: EMBEDDING_MODEL,
  });
  const embedding = embeddingResponse.data[0]?.embedding;
  if (!embedding || embedding.length !== 1536) {
    return NextResponse.json(
      { error: "Failed to generate valid embedding" },
      { status: 500 }
    );
  }

  const { error: upsertError } = await supabase.from("episode_embeddings").upsert(
    {
      embedding,
      episode_id: episodeId,
      model: EMBEDDING_MODEL,
    },
    { onConflict: "episode_id" }
  );

  if (upsertError) {
    return NextResponse.json(
      { error: upsertError.message ?? "Failed to store embedding" },
      { status: 500 }
    );
  }

  return NextResponse.json({ data: { ok: true } });
}
