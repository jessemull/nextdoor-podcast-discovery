import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockAnthropicMessagesCreate } = vi.hoisted(() => ({
  mockAnthropicMessagesCreate: vi.fn(),
}));

vi.mock("@anthropic-ai/sdk", () => ({
  default: class AnthropicMock {
    messages = { create: mockAnthropicMessagesCreate };
  },
}));

import { GET } from "@/app/api/search/suggestions/route";
import { SEARCH_SUGGESTIONS } from "@/lib/constants";

vi.mock("@/lib/supabase-server-auth", () => ({
  getSession: vi.fn(),
}));

vi.mock("@/lib/embedding-cache.server", () => ({
  getCachedEmbedding: vi.fn(),
  setCachedEmbedding: vi.fn(),
}));

vi.mock("@/lib/env.server", () => ({
  CLAUDE_MODEL: "claude-test",
  env: { OPENAI_API_KEY: "sk-test" },
}));

vi.mock("@/lib/log.server", () => ({
  logError: vi.fn(),
}));

const mockRpc = vi.fn();
vi.mock("@/lib/supabase.server", () => ({
  getSupabaseAdmin: () => ({ rpc: mockRpc }),
}));

import { getCachedEmbedding } from "@/lib/embedding-cache.server";
import { getSession } from "@/lib/supabase-server-auth";

const embedding1536 = Array.from({ length: 1536 }, (_, i) => (i % 10) / 10);

describe("GET /api/search/suggestions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getSession).mockResolvedValue({
      user: { email: "a@b.com", id: "u1" },
    } as never);
    vi.mocked(getCachedEmbedding).mockResolvedValue(null);
    mockRpc.mockResolvedValue({ data: null, error: null });
  });

  it("should return 401 when not authenticated", async () => {
    vi.mocked(getSession).mockResolvedValue(null);

    const request = new NextRequest(
      "http://localhost:3000/api/search/suggestions?q=hi"
    );
    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error).toBe("Unauthorized");
  });

  it("should return 400 when limit is NaN", async () => {
    const request = new NextRequest(
      "http://localhost:3000/api/search/suggestions?q=a&limit=abc"
    );
    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe("Invalid limit");
  });

  it("should return prefix suggestions when q length is under 2", async () => {
    const request = new NextRequest(
      "http://localhost:3000/api/search/suggestions?q=d&limit=5"
    );
    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(Array.isArray(body.data)).toBe(true);
    const expected = SEARCH_SUGGESTIONS.filter((s) =>
      s.toLowerCase().startsWith("d")
    ).slice(0, 5);
    expect(body.data).toEqual(expected);
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it("should return default prefix list when q is empty", async () => {
    const request = new NextRequest(
      "http://localhost:3000/api/search/suggestions?limit=3"
    );
    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data).toEqual(SEARCH_SUGGESTIONS.slice(0, 3));
  });

  it("should merge LLM suggestions when embedding and RPC succeed", async () => {
    vi.mocked(getCachedEmbedding).mockResolvedValue(embedding1536);
    mockRpc.mockResolvedValue({
      data: [
        {
          id: "p1",
          similarity: 0.9,
          text: "Neighborhood drama about parking spots on Oak Street",
        },
      ],
      error: null,
    });

    mockAnthropicMessagesCreate.mockResolvedValue({
      content: [
        {
          text: '["oak street parking", "neighbor dispute tips"]',
          type: "text",
        },
      ],
    });

    const request = new NextRequest(
      "http://localhost:3000/api/search/suggestions?q=oak&limit=10"
    );
    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data.length).toBeGreaterThan(0);
    expect(mockRpc).toHaveBeenCalled();
    expect(mockAnthropicMessagesCreate).toHaveBeenCalled();
  });
});
