import { beforeEach, describe, expect, it, vi } from "vitest";

import { GET } from "@/app/api/sports-fact/route";

// Mock next-auth
vi.mock("next-auth", () => ({
  getServerSession: vi.fn(),
}));

// Mock auth options
vi.mock("@/lib/auth", () => ({
  authOptions: {},
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

import { getServerSession } from "next-auth";

describe("GET /api/sports-fact", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return 401 when not authenticated", async () => {
    vi.mocked(getServerSession).mockResolvedValue(null);

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe("Unauthorized");
  });

  it("should return 401 when session has no user", async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      expires: "2099-01-01",
    } as never);

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe("Unauthorized");
  });

  it("should return sports fact from Claude API", async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { email: "test@example.com" },
      expires: "2099-01-01",
    } as never);

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

  it("should return 500 and error when Claude API fails", async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { email: "test@example.com" },
      expires: "2099-01-01",
    } as never);

    mockMessagesCreate.mockRejectedValue(new Error("API error"));

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe("Failed to generate sports fact");
  });

  it("should handle non-text content from Claude", async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { email: "test@example.com" },
      expires: "2099-01-01",
    } as never);

    // Mock response with non-text content
    mockMessagesCreate.mockResolvedValue({
      content: [
        {
          type: "image",
          // Claude API content block type is dynamic; use any for test fixture.
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any,
      ],
    });

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.fact).toBe("");
  });

  it("should handle empty content array from Claude", async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { email: "test@example.com" },
      expires: "2099-01-01",
    } as never);

    mockMessagesCreate.mockResolvedValue({
      content: [],
    });

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.fact).toBe("");
  });
});
