import { NextRequest, NextResponse } from "next/server";

import { buildScoringFewShotIdeal } from "@/lib/build-scoring-few-shot-ideal.server";
import { logError } from "@/lib/log.server";
import { getSession } from "@/lib/supabase-server-auth";
import { getSupabaseAdmin } from "@/lib/supabase.server";
import {
  DEFAULT_SCORING_FEW_SHOT_INTRO,
  SCORING_FEW_SHOT_MAX_EXAMPLES,
  scoringFewShotAddPostsBodySchema,
  scoringFewShotConfigSchema,
} from "@/lib/validators";

import type { Database } from "@/lib/database.types";

type LlmRow = Database["public"]["Tables"]["llm_scores"]["Row"];

/**
 * POST /api/settings/scoring-few-shot/add-posts
 *
 * Appends posts to settings.scoring_few_shot.examples (max 6 total).
 * Ideal fields are prefilled from llm_scores when present.
 */
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsedBody = scoringFewShotAddPostsBodySchema.safeParse(body);
  if (!parsedBody.success) {
    const msg = parsedBody.error.errors[0]?.message ?? "Invalid request body";
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  const orderedIds = parsedBody.data.post_ids;
  const uniqueRequestIds = [...new Set(orderedIds)];

  const supabase = getSupabaseAdmin();

  try {
    const { data: row, error: rowError } = await supabase
      .from("settings")
      .select("value")
      .eq("key", "scoring_few_shot")
      .maybeSingle();

    if (rowError) {
      logError("[add-posts] settings fetch", rowError);
      return NextResponse.json({ error: "Failed to load settings" }, { status: 500 });
    }

    const raw = row?.value;
    const parsedConfig = scoringFewShotConfigSchema.safeParse(raw);
    let intro: string;
    let examples: { ideal: ReturnType<typeof buildScoringFewShotIdeal>; post_id: string }[];

    if (parsedConfig.success) {
      intro = parsedConfig.data.intro;
      examples = [...parsedConfig.data.examples];
    } else {
      intro = DEFAULT_SCORING_FEW_SHOT_INTRO.trim();
      examples = [];
    }

    let skipped_already_in_few_shot = 0;
    let skipped_invalid_or_missing_post = 0;
    let skipped_list_full = 0;
    let added = 0;

    const { data: postRows, error: postsError } = await supabase
      .from("posts")
      .select("id, text")
      .in("id", uniqueRequestIds);

    if (postsError) {
      logError("[add-posts] posts fetch", postsError);
      return NextResponse.json({ error: "Failed to load posts" }, { status: 500 });
    }

    const postMap = new Map(
      (postRows ?? []).map((p) => [p.id as string, p.text as string])
    );

    const { data: llmRows, error: llmError } = await supabase
      .from("llm_scores")
      .select("*")
      .in("post_id", uniqueRequestIds);

    if (llmError) {
      logError("[add-posts] llm_scores fetch", llmError);
      return NextResponse.json({ error: "Failed to load scores" }, { status: 500 });
    }

    const llmMap = new Map<string, LlmRow>(
      (llmRows ?? []).map((r) => [r.post_id as string, r as LlmRow])
    );

    const seenInRequest = new Set<string>();

    for (const postId of orderedIds) {
      if (seenInRequest.has(postId)) {
        continue;
      }
      seenInRequest.add(postId);

      if (examples.length >= SCORING_FEW_SHOT_MAX_EXAMPLES) {
        skipped_list_full += 1;
        continue;
      }
      if (examples.some((e) => e.post_id === postId)) {
        skipped_already_in_few_shot += 1;
        continue;
      }
      const text = postMap.get(postId);
      if (text === undefined) {
        skipped_invalid_or_missing_post += 1;
        continue;
      }

      const llmRow = llmMap.get(postId) ?? null;
      const llm = llmRow
        ? {
            categories: Array.isArray(llmRow.categories)
              ? llmRow.categories.filter((c): c is string => typeof c === "string")
              : [],
            scores: llmRow.scores,
            summary: llmRow.summary,
            why_podcast_worthy: llmRow.why_podcast_worthy,
          }
        : null;

      const ideal = buildScoringFewShotIdeal({ llm, postText: text });
      examples.push({ ideal, post_id: postId });
      added += 1;
    }

    if (added === 0) {
      return NextResponse.json({
        data: {
          added,
          skipped_already_in_few_shot,
          skipped_invalid_or_missing_post,
          skipped_list_full,
        },
      });
    }

    const nextConfig = { examples, intro };
    const validated = scoringFewShotConfigSchema.safeParse(nextConfig);
    if (!validated.success) {
      logError("[add-posts] merged config invalid", validated.error);
      return NextResponse.json({ error: "Merged few-shot config failed validation" }, { status: 500 });
    }

    const { error: upsertError } = await supabase.from("settings").upsert(
      { key: "scoring_few_shot", value: validated.data },
      { onConflict: "key" }
    );

    if (upsertError) {
      logError("[add-posts] upsert", upsertError);
      return NextResponse.json({ error: "Failed to save settings" }, { status: 500 });
    }

    return NextResponse.json({
      data: {
        added,
        skipped_already_in_few_shot,
        skipped_invalid_or_missing_post,
        skipped_list_full,
      },
    });
  } catch (error) {
    logError("[add-posts] unexpected", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
