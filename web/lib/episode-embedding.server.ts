import OpenAI from "openai";
import "server-only";

import { env } from "@/lib/env.server";
import { getSupabaseAdmin } from "@/lib/supabase.server";

const EMBEDDING_MODEL = "text-embedding-3-small";

/**
 * Fetch episode text, generate embedding via OpenAI, and upsert into episode_embeddings.
 * Used for related-episodes similarity. Throws on failure.
 */
export async function computeAndUpsertEpisodeEmbedding(
  episodeId: string
): Promise<void> {
  const supabase = getSupabaseAdmin();
  const { data: episode, error: fetchError } = await supabase
    .from("podcast_episodes")
    .select("id, title, description, show_notes")
    .eq("id", episodeId)
    .single();

  if (fetchError || !episode) {
    throw new Error(fetchError?.message ?? "Episode not found");
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
    return;
  }

  const openaiApiKey = env.OPENAI_API_KEY;
  if (!openaiApiKey) {
    throw new Error("OPENAI_API_KEY is not configured");
  }

  const openai = new OpenAI({ apiKey: openaiApiKey });
  const embeddingResponse = await openai.embeddings.create({
    input: text.slice(0, 8000),
    model: EMBEDDING_MODEL,
  });
  const embedding = embeddingResponse.data[0]?.embedding;
  if (!embedding || embedding.length !== 1536) {
    throw new Error("Failed to generate valid embedding");
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
    throw new Error(upsertError.message ?? "Failed to store embedding");
  }
}
