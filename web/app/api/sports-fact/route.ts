import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";

import { auth0 } from "@/lib/auth0";
import { CLAUDE_MODEL } from "@/lib/env.server";

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

export async function GET(): Promise<NextResponse<ErrorResponse | SportsFactResponse>> {
  const session = await auth0.getSession();

  // Just require any authenticated user

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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

    return NextResponse.json({ fact });
  } catch (error) {
    console.error("Failed to generate sports fact:", error);

    // We do not use a fallback fact; keep behavior simple and surface the failure.
    return NextResponse.json(
      { error: "Failed to generate sports fact" },
      { status: 500 }
    );
  }
}
