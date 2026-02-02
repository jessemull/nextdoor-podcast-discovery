import Anthropic from "@anthropic-ai/sdk";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

import { authOptions } from "@/lib/auth";
import { CLAUDE_MODEL, env } from "@/lib/env.server";

import type { ErrorResponse, SportsFactResponse } from "@/lib/types";

// Lazy-initialized Anthropic client
let _anthropic: Anthropic | null = null;

function getAnthropic(): Anthropic {
  if (!_anthropic) {
    _anthropic = new Anthropic();
  }
  return _anthropic;
}

const SPORTS_FACT_PROMPT = `Give me one random, interesting, and lesser-known fact about Pittsburgh sports teams (Steelers, Pirates, or Penguins). 

Requirements:
- Pick a random team each time
- Make it surprising or amusing
- Keep it to 1-2 sentences
- Include the year if relevant
- Don't repeat common facts everyone knows

Return ONLY the fact, no preamble.`;

export async function GET(): Promise<NextResponse<ErrorResponse | SportsFactResponse>> {
  const session = await getServerSession(authOptions);
  const mattEmail = env.MATT_EMAIL;

  if (!session?.user?.email || session.user.email !== mattEmail) {
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

    const fact =
      response.content[0].type === "text" ? response.content[0].text : "";

    return NextResponse.json({ fact });
  } catch (error) {
    console.error("Failed to generate sports fact:", error);

    // Return fallback with a flag indicating it's not from the API
    return NextResponse.json({
      fact: "The Steelers have won 6 Super Bowls, more than any other NFL team!",
      source: "fallback",
    } as SportsFactResponse);
  }
}
