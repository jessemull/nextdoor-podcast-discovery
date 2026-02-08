import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";

import { authOptions } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase.server";
import { UUID_REGEX } from "@/lib/validators";

import type { Database } from "@/lib/database.types";
import type { LLMScore, PostWithScores } from "@/lib/types";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/posts/[id]
 *
 * Fetch a single post with LLM scores and neighborhood. Requires authentication.
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  if (!UUID_REGEX.test(id)) {
    return NextResponse.json({ error: "Invalid post ID format" }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();

  try {
    const { data: post, error: postError } = await supabase
      .from("posts")
      .select("*, neighborhood:neighborhoods(*)")
      .eq("id", id)
      .single();

    if (postError) {
      if (postError.code === "PGRST116") {
        return NextResponse.json(
          { details: "Post not found", error: "Not found" },
          { status: 404 }
        );
      }
      console.error("[posts/[id]] Error fetching post:", {
        code: postError.code,
        error: postError.message,
        postId: id,
      });
      return NextResponse.json(
        { details: postError.message || "Failed to fetch post", error: "Database error" },
        { status: 500 }
      );
    }

    if (!post) {
      return NextResponse.json(
        { details: "Post not found", error: "Not found" },
        { status: 404 }
      );
    }

    const { data: llmScore, error: scoreError } = await supabase
      .from("llm_scores")
      .select("*")
      .eq("post_id", id)
      .single();

    if (scoreError && scoreError.code !== "PGRST116") {
      console.error("[posts/[id]] Error fetching LLM score:", {
        code: scoreError.code,
        error: scoreError.message,
        postId: id,
      });
    }

    const postRow = post as {
      neighborhood: Database["public"]["Tables"]["neighborhoods"]["Row"] | null;
    } & Database["public"]["Tables"]["posts"]["Row"];

    const result: PostWithScores = {
      ...postRow,
      image_urls: (postRow.image_urls as string[]) || [],
      llm_scores: llmScore
        ? ({
            categories: llmScore.categories || [],
            created_at: llmScore.created_at,
            final_score: llmScore.final_score,
            id: llmScore.id,
            model_version: llmScore.model_version || "claude-3-haiku-20240307",
            post_id: llmScore.post_id,
            scores: (llmScore.scores as LLMScore["scores"]) || {},
            summary: llmScore.summary,
            why_podcast_worthy: llmScore.why_podcast_worthy ?? null,
          } as LLMScore)
        : null,
      neighborhood: postRow.neighborhood,
    };

    return NextResponse.json({ data: result });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    const errorDetails = process.env.NODE_ENV === "development" ? errorMessage : undefined;
    console.error("[posts/[id]] Unexpected error:", {
      error: errorMessage,
      postId: id,
      stack: error instanceof Error ? error.stack : undefined,
    });
    return NextResponse.json(
      { details: errorDetails, error: "Internal server error" },
      { status: 500 }
    );
  }
}
