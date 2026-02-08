import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, type MockedFunction, vi } from "vitest";

import { clearEmbeddingCacheForTest } from "@/lib/embedding-cache.server";
import { POST } from "@/app/api/search/route";

// Mock next-auth
vi.mock("next-auth", () => ({
  getServerSession: vi.fn(),
}));

// Mock auth options
vi.mock("@/lib/auth", () => ({
  authOptions: {},
}));

// Mock server-only env module
vi.mock("@/lib/env.server", () => ({
  env: {
    OPENAI_API_KEY: "test-openai-key",
  },
}));

// Mock OpenAI - use a shared instance
const mockCreate = vi.fn();
const mockEmbeddings = {
  create: mockCreate,
};
const mockOpenAIInstance = {
  embeddings: mockEmbeddings,
};

vi.mock("openai", () => ({
  default: vi.fn(() => mockOpenAIInstance),
}));

// Mock Supabase — client chain is dynamic; mocks use "as any" for fluent test setup.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockRpc = vi.fn() as any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockFrom = vi.fn() as any;

const mockSupabase = {
  from: mockFrom,
  rpc: mockRpc,
};

vi.mock("@/lib/supabase.server", () => ({
  getSupabaseAdmin: () => mockSupabase,
}));

import { getServerSession } from "next-auth";

/** Chain for supabase.from().select().in() used when enriching search results. */
const fromSelectInChain = () => ({
  select: vi.fn(() => ({
    in: vi.fn(() => Promise.resolve({ data: [], error: null })),
  })),
});

describe("POST /api/search", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearEmbeddingCacheForTest();
    mockFrom.mockImplementation(() => fromSelectInChain());
    mockCreate.mockResolvedValue({
      data: [{ embedding: new Array(1536).fill(0.1) }],
    });
  });

  it("should return 401 when not authenticated", async () => {
    vi.mocked(getServerSession).mockResolvedValue(null);

    const request = new NextRequest("http://localhost:3000/api/search", {
      body: JSON.stringify({ query: "test query" }),
      method: "POST",
    });
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe("Unauthorized");
  });

  it("should return 400 when query is missing", async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { email: "test@example.com" },
    });

    const request = new NextRequest("http://localhost:3000/api/search", {
      body: JSON.stringify({}),
      method: "POST",
    });
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBeDefined();
    expect(
      data.error.includes("Query is required") || data.error.includes("Required")
    ).toBe(true);
  });

  it("should return 400 when query is empty string", async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { email: "test@example.com" },
    });

    const request = new NextRequest("http://localhost:3000/api/search", {
      body: JSON.stringify({ query: "   " }),
      method: "POST",
    });
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain("Query is required");
  });

  it("should return 400 when query is too long", async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { email: "test@example.com" },
    });

    const longQuery = "a".repeat(1001);
    const request = new NextRequest("http://localhost:3000/api/search", {
      body: JSON.stringify({ query: longQuery }),
      method: "POST",
    });
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain("Query too long");
  });

  it("should return 500 when OpenAI API fails", async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { email: "test@example.com" },
    });

    mockCreate.mockRejectedValue(new Error("API error"));

    const request = new NextRequest("http://localhost:3000/api/search", {
      body: JSON.stringify({ query: "test query" }),
      method: "POST",
    });
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe("Internal server error");
  });

  it("should return 500 when embedding is invalid", async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { email: "test@example.com" },
    });

    mockCreate.mockResolvedValue({
      data: [{ embedding: [0.1] }], // Wrong dimension
    });

    const request = new NextRequest("http://localhost:3000/api/search", {
      body: JSON.stringify({ query: "test query" }),
      method: "POST",
    });
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe("Failed to generate valid embedding");
  });

  it("should return empty results when no posts found", async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { email: "test@example.com" },
    });

    mockCreate.mockResolvedValue({
      data: [{ embedding: new Array(1536).fill(0.1) }],
    });

    mockRpc.mockResolvedValue({
      data: [],
      error: null,
    });

    const request = new NextRequest("http://localhost:3000/api/search", {
      body: JSON.stringify({ query: "test query" }),
      method: "POST",
    });
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.data).toEqual([]);
    expect(data.total).toBe(0);
  });

  it("should return search results with posts", async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { email: "test@example.com" },
    });

    mockCreate.mockResolvedValue({
      data: [{ embedding: new Array(1536).fill(0.1) }],
    });

    mockRpc.mockResolvedValue({
      data: [
        {
          id: "post-1",
          text: "Test post",
          similarity: 0.8,
          created_at: "2024-01-01T00:00:00Z",
          neighborhood_id: "neigh-1",
          post_id_ext: "ext-1",
          url: "https://nextdoor.com/p/1",
          user_id_hash: "user1",
          image_urls: [],
          hash: "hash1",
          used_on_episode: false,
          episode_date: null,
        },
      ],
      error: null,
    });

    mockFrom.mockReturnValue({
      select: vi.fn(() => ({
        in: vi.fn(() => ({
          data: [],
          error: null,
        })),
      })),
    });

    const request = new NextRequest("http://localhost:3000/api/search", {
      body: JSON.stringify({ query: "test query" }),
      method: "POST",
    });
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.data).toHaveLength(1);
    expect(data.data[0].id).toBe("post-1");
    expect(data.data[0].text).toBe("Test post");
  });

  it("should validate and clamp limit parameter", async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { email: "test@example.com" },
    });

    mockCreate.mockResolvedValue({
      data: [{ embedding: new Array(1536).fill(0.1) }],
    });

    mockRpc.mockResolvedValue({
      data: [],
      error: null,
    });

    const request = new NextRequest("http://localhost:3000/api/search", {
      body: JSON.stringify({ limit: 100, query: "test" }), // Over max
      method: "POST",
    });
    await POST(request);

    // Should have called with clamped limit (50)
    expect(mockRpc).toHaveBeenCalledWith(
      "search_posts_by_embedding",
      expect.objectContaining({
        result_limit: 50,
      })
    );
  });

  it("should validate and clamp similarity_threshold parameter", async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { email: "test@example.com" },
    });

    mockCreate.mockResolvedValue({
      data: [{ embedding: new Array(1536).fill(0.1) }],
    });

    mockRpc.mockResolvedValue({
      data: [],
      error: null,
    });

    const request = new NextRequest("http://localhost:3000/api/search", {
      body: JSON.stringify({ similarity_threshold: 1.5, query: "test" }), // Over max
      method: "POST",
    });
    await POST(request);

    // Should have called with clamped threshold (1.0)
    expect(mockRpc).toHaveBeenCalledWith(
      "search_posts_by_embedding",
      expect.objectContaining({
        similarity_threshold: 1.0,
      })
    );
  });
});
