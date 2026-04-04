import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";

import { CLAUDE_MODEL } from "@/lib/env.server";
import { logError } from "@/lib/log.server";
import {
  consumeSportsFactRateLimit,
  getCachedSportsFact,
  setCachedSportsFact,
} from "@/lib/sports-fact.server";
import { getSession } from "@/lib/supabase-server-auth";

import type { ErrorResponse, SportsFactResponse } from "@/lib/types";

// Lazy-initialized Anthropic client

let _anthropic: Anthropic | null = null;

function getAnthropic(): Anthropic {
  if (!_anthropic) {
    _anthropic = new Anthropic();
  }
  return _anthropic;
}

const SPORTS_FACT_PROMPT = `Give me exactly ONE random, lesser-known fact about ONE Pittsburgh sports team (Steelers, Pirates, or Penguins).

Rules:
- ONE fact only, about ONE team
- Maximum 2 sentences
- Make it surprising or obscure
- No introductions, just the fact

Example format: "In 1995, the Pittsburgh Penguins mascot Iceburgh was once ejected from a game for spraying silly string on a referee."`;

export async function GET(
  _request?: NextRequest
): Promise<NextResponse<ErrorResponse | SportsFactResponse>> {
  const session = await getSession();

  // Just require any authenticated user

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const cached = await getCachedSportsFact();
  if (cached != null) {
    return NextResponse.json(
      { fact: cached },
      { headers: { "X-Sports-Fact-Cache": "HIT" } }
    );
  }

  const rate = await consumeSportsFactRateLimit(session.user.id);
  if (!rate.allowed) {
    const headers: Record<string, string> = {};
    if (rate.retryAfterSec != null) {
      headers["Retry-After"] = String(rate.retryAfterSec);
    }

    return NextResponse.json(
      { error: "Too many sports fact requests; try again later." },
      { headers, status: 429 }
    );
  }

  try {
    const response = await getAnthropic().messages.create({
      max_tokens: 150,
      messages: [
        {
          content: SPORTS_FACT_PROMPT,
          role: "user",
        },
      ],
      model: CLAUDE_MODEL,
    });

    const firstBlock = response.content?.[0];
    const fact =
      firstBlock?.type === "text" ? (firstBlock as { text: string; type: "text" }).text : "";

    if (fact.trim().length > 0) {
      await setCachedSportsFact(fact);
    }

    return NextResponse.json(
      { fact },
      { headers: { "X-Sports-Fact-Cache": "MISS" } }
    );
  } catch (error) {
    logError("[sports-fact]", error);

    // We do not use a fallback fact; keep behavior simple and surface the failure.
    return NextResponse.json(
      { error: "Failed to generate sports fact" },
      { status: 500 }
    );
  }
}
