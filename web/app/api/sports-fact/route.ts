import Anthropic from "@anthropic-ai/sdk";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

import { authOptions } from "@/lib/auth";
import { CLAUDE_MODEL } from "@/lib/env";
import type { SportsFactResponse, ErrorResponse } from "@/lib/types";

const anthropic = new Anthropic();

const MATT_EMAIL = process.env.MATT_EMAIL;

const SPORTS_FACT_PROMPT = `Give me one random, interesting, and lesser-known fact about Pittsburgh sports teams (Steelers, Pirates, or Penguins). 

Requirements:
- Pick a random team each time
- Make it surprising or amusing
- Keep it to 1-2 sentences
- Include the year if relevant
- Don't repeat common facts everyone knows

Return ONLY the fact, no preamble.`;

export async function GET(): Promise<NextResponse<SportsFactResponse | ErrorResponse>> {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email || session.user.email !== MATT_EMAIL) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const response = await anthropic.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 150,
      messages: [
        {
          role: "user",
          content: SPORTS_FACT_PROMPT,
        },
      ],
    });

    const fact =
      response.content[0].type === "text" ? response.content[0].text : "";

    return NextResponse.json({ fact });
  } catch (error) {
    console.error("Failed to generate sports fact:", error);
    return NextResponse.json({
      fact: "The Steelers have won 6 Super Bowls, more than any other NFL team!",
    });
  }
}
