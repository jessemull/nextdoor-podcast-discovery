import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

import { authOptions } from "@/lib/auth";
import { env } from "@/lib/env.server";
import { getSupabaseAdmin } from "@/lib/supabase.server";

import type { PostWithScores } from "@/lib/types";

/**
 * Type for search result from RPC function.
 */
interface SearchResult {
  created_at: string;
  episode_date: null | string;
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
 * Maximum query length for search (to prevent expensive API calls).
 */
const MAX_QUERY_LENGTH = 1000;

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
    const { limit = 10, query, similarity_threshold = 0.5 } = body;

    if (!query || typeof query !== "string" || query.trim().length === 0) {
      return NextResponse.json(
        { error: "Query is required and must be a non-empty string" },
        { status: 400 }
      );
    }

    // Validate query length

    const trimmedQuery = query.trim();
    if (trimmedQuery.length > MAX_QUERY_LENGTH) {
      return NextResponse.json(
        {
          error: `Query too long (max ${MAX_QUERY_LENGTH} characters)`,
        },
        { status: 400 }
      );
    }

    // Validate limit

    const parsedLimit = parseInt(String(limit));
    const validLimit = Math.min(
      isNaN(parsedLimit) ? 10 : parsedLimit,
      50
    );

    // Validate similarity threshold

    const parsedThreshold = parseFloat(String(similarity_threshold));
    const validThreshold = Math.max(
      0,
      Math.min(1, isNaN(parsedThreshold) ? 0.5 : parsedThreshold)
    );

    // Generate embedding for the query
    let openaiApiKey: string;
    try {
      openaiApiKey = env.OPENAI_API_KEY;
    } catch (err) {
      console.error("[search] Missing OPENAI_API_KEY environment variable");
      return NextResponse.json(
        {
          details: "OPENAI_API_KEY environment variable is required for semantic search",
          error: "Configuration error",
        },
        { status: 500 }
      );
    }

    const openai = new OpenAI({
      apiKey: openaiApiKey,
    });

    const embeddingResponse = await openai.embeddings.create({
      input: trimmedQuery,
      model: EMBEDDING_MODEL,
    });

    const queryEmbedding = embeddingResponse.data[0].embedding;

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
      console.error("[search] Database search failed:", {
        code: searchError.code,
        error: searchError.message,
        hint: searchError.hint,
        query: trimmedQuery.substring(0, 50),
      });

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
      console.error("[search] Failed to fetch LLM scores:", {
        code: scoresError.code,
        error: scoresError.message,
        postCount: postIds.length,
      });
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
      console.error("[search] Failed to fetch neighborhoods:", {
        code: neighborhoodsError.code,
        error: neighborhoodsError.message,
        neighborhoodCount: neighborhoodIds.length,
      });
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

    const posts = searchResultsList.map((result: SearchResult) => ({
        created_at: result.created_at,
        episode_date: result.episode_date,
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
        text: result.text,
        url: result.url,
        used_on_episode: result.used_on_episode,
        user_id_hash: result.user_id_hash,
      })
    ) as unknown as PostWithScores[];

    return NextResponse.json({
      data: posts,
      total: posts.length,
    });
  } catch (error) {
    console.error("[search] Unexpected error:", {
      error: error instanceof Error ? error.message : "Unknown error",
      stack: error instanceof Error ? error.stack : undefined,
      type: error instanceof Error ? error.constructor.name : typeof error,
    });

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
