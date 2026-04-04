import { beforeEach, describe, expect, it, vi } from "vitest";

import { GET } from "@/app/api/sports-fact/route";

// Mock auth
vi.mock("@/lib/supabase-server-auth", () => ({
  getSession: vi.fn(),
}));

// Mock env.server
vi.mock("@/lib/env.server", () => ({
  CLAUDE_MODEL: "claude-3-haiku-20240307",
}));

// Mock Anthropic
const mockMessagesCreate = vi.fn();
const mockAnthropicInstance = {
  messages: {
    create: mockMessagesCreate,
  },
};

vi.mock("@anthropic-ai/sdk", () => ({
  default: vi.fn(() => mockAnthropicInstance),
}));

import * as sportsFactServer from "@/lib/sports-fact.server";
import { getSession } from "@/lib/supabase-server-auth";

describe("GET /api/sports-fact", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sportsFactServer.resetSportsFactServerStateForTests();
  });

  it("should return 401 when not authenticated", async () => {
    vi.mocked(getSession).mockResolvedValue(null);

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe("Unauthorized");
  });

  it("should return 401 when session has no user", async () => {
    vi.mocked(getSession).mockResolvedValue(null);

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe("Unauthorized");
  });

  it("should return sports fact from Claude API", async () => {
    vi.mocked(getSession).mockResolvedValue({
      user: { email: "test@example.com", id: "test-user-id" },
    });

    const mockFact = "In 1995, the Pittsburgh Penguins mascot Iceburgh was once ejected from a game for spraying silly string on a referee.";

    mockMessagesCreate.mockResolvedValue({
      content: [
        {
          text: mockFact,
          type: "text",
        },
      ],
    });

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.fact).toBe(mockFact);
    expect(mockMessagesCreate).toHaveBeenCalledWith({
      max_tokens: 150,
      messages: [
        {
          content: expect.stringContaining("Pittsburgh"),
          role: "user",
        },
      ],
      model: "claude-3-haiku-20240307",
    });
  });

  it("should call Claude once and serve cache on second request", async () => {
    vi.mocked(getSession).mockResolvedValue({
      user: { email: "test@example.com", id: "test-user-id" },
    });

    const mockFact =
      "In 1995, the Pittsburgh Penguins mascot Iceburgh was once ejected from a game for spraying silly string on a referee.";

    mockMessagesCreate.mockResolvedValue({
      content: [
        {
          text: mockFact,
          type: "text",
        },
      ],
    });

    const response1 = await GET();
    const response2 = await GET();

    expect(response1.status).toBe(200);
    expect(response2.status).toBe(200);
    expect(mockMessagesCreate).toHaveBeenCalledTimes(1);
    expect((await response1.json()).fact).toBe(mockFact);
    expect((await response2.json()).fact).toBe(mockFact);
    expect(response1.headers.get("X-Sports-Fact-Cache")).toBe("MISS");
    expect(response2.headers.get("X-Sports-Fact-Cache")).toBe("HIT");
  });

  it("should return 429 after too many cache misses per user per hour", async () => {
    vi.mocked(getSession).mockResolvedValue({
      user: { email: "heavy@example.com", id: "heavy-user" },
    });

    const spy = vi
      .spyOn(sportsFactServer, "getCachedSportsFact")
      .mockResolvedValue(null);

    mockMessagesCreate.mockResolvedValue({
      content: [{ text: "A Pittsburgh sports fact.", type: "text" }],
    });

    for (let i = 0; i < 12; i++) {
      const res = await GET();
      expect(res.status).toBe(200);
    }

    const blocked = await GET();
    expect(blocked.status).toBe(429);
    const body = await blocked.json();
    expect(body.error).toContain("Too many");
    expect(mockMessagesCreate).toHaveBeenCalledTimes(12);

    spy.mockRestore();
  });

  it("should return 500 and error when Claude API fails", async () => {
    vi.mocked(getSession).mockResolvedValue({
      user: { email: "test@example.com", id: "test-user-id" },
    });

    mockMessagesCreate.mockRejectedValue(new Error("API error"));

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe("Failed to generate sports fact");
  });

  it("should handle non-text content from Claude", async () => {
    vi.mocked(getSession).mockResolvedValue({
      user: { email: "test@example.com", id: "test-user-id" },
    });

    // Mock response with non-text content
    mockMessagesCreate.mockResolvedValue({
      content: [
        {
          type: "image",
          // Claude API content block type is dynamic; use any for test fixture.
           
        } as any,
      ],
    });

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.fact).toBe("");
  });

  it("should handle empty content array from Claude", async () => {
    vi.mocked(getSession).mockResolvedValue({
      user: { email: "test@example.com", id: "test-user-id" },
    });

    mockMessagesCreate.mockResolvedValue({
      content: [],
    });

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.fact).toBe("");
  });
});
