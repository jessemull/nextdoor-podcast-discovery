import Anthropic from "@anthropic-ai/sdk";
import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

import { authOptions } from "@/lib/auth";
import { SEARCH_SUGGESTIONS } from "@/lib/constants";
import {
  getCachedEmbedding,
  setCachedEmbedding,
} from "@/lib/embedding-cache.server";
import { CLAUDE_MODEL, env } from "@/lib/env.server";
import { logError } from "@/lib/log.server";
import { getSupabaseAdmin } from "@/lib/supabase.server";

const EMBEDDING_MODEL = "text-embedding-3-small";
const SUGGESTIONS_SIMILARITY_THRESHOLD = 0.25;
const SUGGESTIONS_POST_LIMIT = 5;
const SNIPPET_MAX_LEN = 120;
const CACHE_KEY_THRESHOLD = 0;

interface SearchResultRow {
  id: string;
  similarity: number;
  text: string;
}

let _anthropic: Anthropic | null = null;

function getAnthropic(): Anthropic {
  if (!_anthropic) {
    _anthropic = new Anthropic();
  }
  return _anthropic;
}

/**
 * GET /api/search/suggestions?q=...&limit=10
 *
 * Returns search query suggestions for autocomplete.
 * 1. Prefix-matched items from SEARCH_SUGGESTIONS.
 * 2. When q.length >= 2: embedding + similar posts + Claude Haiku to suggest
 *    2–3 short phrases grounded in real content; merged and deduped.
 * Requires authentication.
 */
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const searchParams = request.nextUrl.searchParams;
  const q = (searchParams.get("q") ?? "").trim();
  const qLower = q.toLowerCase();
  const limitParam = searchParams.get("limit");
  const limit = Math.min(
    20,
    Math.max(1, limitParam ? parseInt(limitParam, 10) : 10)
  );
  if (Number.isNaN(limit)) {
    return NextResponse.json(
      { error: "Invalid limit" },
      { status: 400 }
    );
  }

  const prefixSuggestions = qLower
    ? SEARCH_SUGGESTIONS.filter((s) =>
        s.toLowerCase().startsWith(qLower)
      ).slice(0, limit)
    : [...SEARCH_SUGGESTIONS].slice(0, limit);

  if (q.length < 2) {
    return NextResponse.json({ data: prefixSuggestions });
  }

  let llmSuggestions: string[] = [];

  try {
    let queryEmbedding: null | number[] = getCachedEmbedding(
      q,
      CACHE_KEY_THRESHOLD
    );

    if (!queryEmbedding) {
      try {
        const openaiApiKey = env.OPENAI_API_KEY;
        const openai = new OpenAI({ apiKey: openaiApiKey });
        const embeddingResponse = await openai.embeddings.create({
          input: q,
          model: EMBEDDING_MODEL,
        });
        queryEmbedding = embeddingResponse.data[0].embedding;
        if (queryEmbedding) {
          setCachedEmbedding(q, CACHE_KEY_THRESHOLD, queryEmbedding);
        }
      } catch (err) {
        logError("[suggestions] embedding", err);
        return NextResponse.json({ data: prefixSuggestions });
      }
    }

    if (
      !queryEmbedding ||
      queryEmbedding.length !== 1536
    ) {
      return NextResponse.json({ data: prefixSuggestions });
    }

    const supabase = getSupabaseAdmin();
    const { data: searchResults, error: searchError } = await supabase.rpc(
      "search_posts_by_embedding",
      {
        query_embedding: queryEmbedding,
        result_limit: SUGGESTIONS_POST_LIMIT,
        similarity_threshold: SUGGESTIONS_SIMILARITY_THRESHOLD,
      }
    );

    if (searchError || !searchResults || searchResults.length === 0) {
      return NextResponse.json({ data: prefixSuggestions });
    }

    const snippets = (searchResults as SearchResultRow[])
      .map((row) => {
        const t = row.text ?? "";
        return t.length > SNIPPET_MAX_LEN
          ? t.slice(0, SNIPPET_MAX_LEN) + "…"
          : t;
      })
      .filter(Boolean);

    if (snippets.length === 0) {
      return NextResponse.json({ data: prefixSuggestions });
    }

    const prompt = `The user is typing this search query: "${q}"

Here are relevant post snippets from our database (Nextdoor-style posts):
${snippets.map((s, i) => `${i + 1}. ${s}`).join("\n")}

Suggest 2 or 3 short search phrases (3–6 words each) they might type to find posts like these. Phrases should be natural search queries, not full sentences.
Return ONLY a JSON array of strings, e.g. ["phrase one", "phrase two"]. No other text.`;

    const response = await getAnthropic().messages.create({
      max_tokens: 150,
      messages: [
        {
          content: prompt,
          role: "user",
        },
      ],
      model: CLAUDE_MODEL,
    });

    const firstBlock = response.content?.[0];
    const text =
      firstBlock?.type === "text"
        ? (firstBlock as { text: string; type: "text" }).text
        : "";

    const parsed = parseJsonArray(text);
    if (Array.isArray(parsed)) {
      llmSuggestions = parsed
        .filter((x): x is string => typeof x === "string" && x.length > 0)
        .slice(0, 3)
        .map((s) => s.trim())
        .filter(Boolean);
    }
  } catch (err) {
    logError("[suggestions] LLM or embedding", err);
  }

  const prefixSet = new Set(
    prefixSuggestions.map((s) => s.toLowerCase().trim())
  );
  const merged = [...prefixSuggestions];
  for (const s of llmSuggestions) {
    const key = s.toLowerCase().trim();
    if (key && !prefixSet.has(key) && merged.length < limit) {
      prefixSet.add(key);
      merged.push(s);
    }
  }

  return NextResponse.json({
    data: merged.slice(0, limit),
  });
}

function parseJsonArray(raw: string): unknown[] {
  const trimmed = raw.trim();
  const match = trimmed.match(/\[[\s\S]*\]/);
  if (!match) return [];
  try {
    const out = JSON.parse(match[0]);
    return Array.isArray(out) ? out : [];
  } catch {
    return [];
  }
}
