import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

import { authOptions } from "@/lib/auth";
import {
  getCachedEmbedding,
  setCachedEmbedding,
} from "@/lib/embedding-cache.server";
import { env } from "@/lib/env.server";
import { logError } from "@/lib/log.server";
import { getSupabaseAdmin } from "@/lib/supabase.server";
import { searchBodySchema, searchQuerySchema } from "@/lib/validators";

import type { PostWithScores } from "@/lib/types";

/**
 * Type for search result from RPC function.
 */
interface SearchResult {
  created_at: string;
  hash: string;
  id: string;
  image_urls: null | string[];
  neighborhood_id: string;
  post_id_ext: string;
  similarity: number;
  text: string;
  url: string;
  used_on_episode: boolean;
  user_id_hash: string;
}

/**
 * OpenAI embedding model used for semantic search.
 * Must match the model used in the scraper (EMBEDDING_MODEL).
 */
const EMBEDDING_MODEL = "text-embedding-3-small";

/**
 * GET /api/search?q=...&limit=...
 *
 * Keyword (full-text) search for posts. Requires authentication.
 * Use when you know exact terms. Falls back to semantic search via POST for meaning-based queries.
 */
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const searchParams = request.nextUrl.searchParams;
  const raw = {
    limit: searchParams.get("limit") ?? undefined,
    q: searchParams.get("q") ?? undefined,
  };
  const parsed = searchQuerySchema.safeParse(raw);
  if (!parsed.success) {
    const first = parsed.error.errors[0];
    const message = first?.message ?? "Invalid query parameters";
    return NextResponse.json({ error: message }, { status: 400 });
  }
  const { limit, q } = parsed.data;

  const supabase = getSupabaseAdmin();

  try {
    const { data: posts, error } = await supabase
      .from("posts")
      .select("*, neighborhood:neighborhoods(*)")
      .textSearch("text_search", q, {
        config: "english",
        type: "websearch",
      })
      .limit(limit);

    if (error) {
      if (error.message?.includes("column") && error.message?.includes("does not exist")) {
        return NextResponse.json(
          {
            details: "Full-text search not available. Run migration 015_fulltext_search.sql",
            error: "Keyword search not configured",
          },
          { status: 500 }
        );
      }
      logError("[search GET]", error);
      return NextResponse.json(
        { details: error.message || "Search failed", error: "Database error" },
        { status: 500 }
      );
    }

    if (!posts || posts.length === 0) {
      return NextResponse.json({ data: [], total: 0 });
    }

    const postIds = posts.map((p: { id: string }) => p.id);
    const { data: scores } = await supabase.from("llm_scores").select("*").in("post_id", postIds);
    const scoresMap = new Map((scores || []).map((s: { post_id: string }) => [s.post_id, s]));

    const results = posts.map((post: Record<string, unknown>) => ({
      ...post,
      image_urls: post.image_urls || [],
      llm_scores: scoresMap.get(post.id as string) || null,
      neighborhood: post.neighborhood || null,
      similarity: null,
    }));

    return NextResponse.json({ data: results, total: results.length });
  } catch (error) {
    logError("[search GET]", error);
    return NextResponse.json(
      {
        details: error instanceof Error ? error.message : "Internal server error",
        error: "Internal server error",
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/search
 *
 * Semantic search for posts using vector embeddings. Requires authentication.
 *
 * Body:
 * - query: string (search query text)
 * - limit: number (default 10, max 50)
 * - similarity_threshold: number (default 0.5, min 0, max 1)
 */
export async function POST(request: NextRequest) {
  // Require authentication
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const parsed = searchBodySchema.safeParse(body);
    if (!parsed.success) {
      const first = parsed.error.errors[0];
      const message = first?.message ?? "Invalid request body";
      return NextResponse.json({ error: message }, { status: 400 });
    }
    const {
      limit: validLimit,
      min_score: minScore,
      query: trimmedQuery,
      similarity_threshold: validThreshold,
    } = parsed.data;

    let queryEmbedding: null | number[] = getCachedEmbedding(
      trimmedQuery,
      validThreshold
    );

    if (!queryEmbedding) {
      let openaiApiKey: string;
      try {
        openaiApiKey = env.OPENAI_API_KEY;
      } catch (err) {
        logError("[search] config", err);
        return NextResponse.json(
          {
            details: "OPENAI_API_KEY environment variable is required for semantic search",
            error: "Configuration error",
          },
          { status: 500 }
        );
      }

      const openai = new OpenAI({ apiKey: openaiApiKey });
      const embeddingResponse = await openai.embeddings.create({
        input: trimmedQuery,
        model: EMBEDDING_MODEL,
      });
      queryEmbedding = embeddingResponse.data[0].embedding;

      if (queryEmbedding) {
        setCachedEmbedding(trimmedQuery, validThreshold, queryEmbedding);
      }
    }

    if (!queryEmbedding || queryEmbedding.length !== 1536) {
      return NextResponse.json(
        { error: "Failed to generate valid embedding" },
        { status: 500 }
      );
    }

    // Search for similar posts using RPC function
    const supabase = getSupabaseAdmin();

    const { data: searchResults, error: searchError } = await supabase.rpc(
      "search_posts_by_embedding",
      {
        query_embedding: queryEmbedding,
        result_limit: validLimit,
        similarity_threshold: validThreshold,
      }
    );

    if (searchError) {
      logError("[search] database", searchError);

      // Provide helpful error message if function doesn't exist
      if (
        searchError.message?.includes("function") &&
        searchError.message?.includes("does not exist")
      ) {
        return NextResponse.json(
          {
            details:
              "Database function not found. Please run migration 003_semantic_search.sql",
            error: "Database search function missing",
          },
          { status: 500 }
        );
      }

      return NextResponse.json(
        {
          details: searchError.message || "Unknown database error",
          error: "Database search failed",
        },
        { status: 500 }
      );
    }

    const searchResultsList = searchResults ?? [];
    if (searchResultsList.length === 0) {
      return NextResponse.json({
        data: [],
        total: 0,
      });
    }

    // Fetch LLM scores and neighborhoods for the found posts

    const postIds = searchResultsList.map((post: SearchResult) => post.id);

    const { data: scores, error: scoresError } = await supabase
      .from("llm_scores")
      .select("*")
      .in("post_id", postIds);

    if (scoresError) {
      logError("[search] LLM scores", scoresError);
      // Continue without scores - posts will have null llm_scores
    }

    const neighborhoodIds = searchResultsList.map(
      (post: SearchResult) => post.neighborhood_id
    );

    const { data: neighborhoods, error: neighborhoodsError } = await supabase
      .from("neighborhoods")
      .select("*")
      .in("id", neighborhoodIds);

    if (neighborhoodsError) {
      logError("[search] neighborhoods", neighborhoodsError);
      // Continue without neighborhoods - posts will have "Unknown" neighborhood
    }

    // Build a map for quick lookups

    const scoresMap = new Map(
      (scores || []).map((score: { post_id: string }) => [score.post_id, score])
    );
    const neighborhoodsMap = new Map(
      (neighborhoods || []).map((neighborhood: { id: string }) => [
        neighborhood.id,
        neighborhood,
      ])
    );

    // Combine results with scores and neighborhoods
    // Include similarity score for display in UI

    const posts = searchResultsList.map((result: SearchResult) => ({
        created_at: result.created_at,
        hash: result.hash,
        id: result.id,
        image_urls: result.image_urls || [],
        llm_scores: scoresMap.get(result.id) || null,
        neighborhood:
          neighborhoodsMap.get(result.neighborhood_id) || {
            created_at: new Date().toISOString(),
            id: result.neighborhood_id,
            name: "Unknown",
            slug: "unknown",
          },
        neighborhood_id: result.neighborhood_id,
        post_id_ext: result.post_id_ext,
        similarity: result.similarity,
        text: result.text,
        url: result.url,
        used_on_episode: result.used_on_episode,
        user_id_hash: result.user_id_hash,
      })
    );

    const filteredPosts =
      minScore != null && minScore > 0
        ? posts.filter((p: { llm_scores: { final_score: number } | null }) => {
            const score = p.llm_scores?.final_score;
            return score != null && score >= minScore;
          })
        : posts;

    return NextResponse.json({
      data: filteredPosts,
      total: filteredPosts.length,
    });
  } catch (error) {
    logError("[search]", error);

    // Check if it's a missing environment variable error
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    if (errorMessage.includes("Missing required environment variable")) {
      return NextResponse.json(
        {
          details: errorMessage,
          error: "Configuration error",
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        details: errorMessage,
        error: "Internal server error",
      },
      { status: 500 }
    );
  }
}
