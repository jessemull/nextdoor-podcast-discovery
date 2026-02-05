import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, type MockedFunction, vi } from "vitest";

import { GET } from "@/app/api/posts/route";

// Mock next-auth
vi.mock("next-auth", () => ({
  getServerSession: vi.fn(),
}));

// Mock auth options
vi.mock("@/lib/auth", () => ({
  authOptions: {},
}));

// Mock Supabase
// Note: Using 'any' here is acceptable for complex Supabase query chain mocks
// The actual implementation is type-safe, but the mock structure is too complex
// to type precisely without significant overhead
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockFrom = vi.fn() as any;

const mockSupabase = {
  from: mockFrom,
};

vi.mock("@/lib/supabase.server", () => ({
  getSupabaseAdmin: () => mockSupabase,
}));

import { getServerSession } from "next-auth";

describe("GET /api/posts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return 401 when not authenticated", async () => {
    vi.mocked(getServerSession).mockResolvedValue(null);

    const request = new NextRequest("http://localhost:3000/api/posts");
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe("Unauthorized");
  });

  it("should return posts when authenticated", async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { email: "test@example.com" },
      expires: "2099-01-01",
    });

    const mockScores = [
      { post_id: "post-1", final_score: 10, categories: ["humor"] },
      { post_id: "post-2", final_score: 8, categories: ["drama"] },
    ];

    const mockPosts = [
      { id: "post-1", text: "Post 1", neighborhood: { name: "Test" } },
      { id: "post-2", text: "Post 2", neighborhood: { name: "Test" } },
    ];

    // Mock scores query chain
    const scoresChain = {
      contains: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      range: vi.fn().mockResolvedValue({
        count: 2,
        data: mockScores,
        error: null,
      }),
      select: vi.fn().mockReturnThis(),
    };

    // Mock posts query chain
    const postsChain = {
      eq: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
    };

    // Set up final resolution for posts
    postsChain.in.mockResolvedValue({
      data: mockPosts,
      error: null,
    });

    mockFrom.mockImplementation((table: string) => {
      if (table === "llm_scores") {
        return { select: () => scoresChain };
      }
      return { select: () => postsChain };
    });

    const request = new NextRequest("http://localhost:3000/api/posts?limit=10");
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.data).toHaveLength(2);
    expect(data.total).toBe(2);
  });

  it("should use default limit and offset when not provided", async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { email: "test@example.com" },
      expires: "2099-01-01",
    });

    const rangeMock = vi.fn().mockResolvedValue({
      count: 0,
      data: [],
      error: null,
    });

    mockFrom.mockImplementation(() => ({
      select: () => ({
        order: () => ({
          range: rangeMock,
        }),
      }),
    }));

    const request = new NextRequest("http://localhost:3000/api/posts");
    await GET(request);

    // Default limit is 20, offset is 0
    expect(rangeMock).toHaveBeenCalledWith(0, 19);
  });

  it("should handle invalid limit gracefully", async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { email: "test@example.com" },
      expires: "2099-01-01",
    });

    const rangeMock = vi.fn().mockResolvedValue({
      count: 0,
      data: [],
      error: null,
    });

    mockFrom.mockImplementation(() => ({
      select: () => ({
        order: () => ({
          range: rangeMock,
        }),
      }),
    }));

    const request = new NextRequest("http://localhost:3000/api/posts?limit=invalid");
    await GET(request);

    // Falls back to default 20
    expect(rangeMock).toHaveBeenCalledWith(0, 19);
  });

  it("should cap limit at 100", async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { email: "test@example.com" },
      expires: "2099-01-01",
    });

    const rangeMock = vi.fn().mockResolvedValue({
      count: 0,
      data: [],
      error: null,
    });

    mockFrom.mockImplementation(() => ({
      select: () => ({
        order: () => ({
          range: rangeMock,
        }),
      }),
    }));

    const request = new NextRequest("http://localhost:3000/api/posts?limit=500");
    await GET(request);

    // Capped at 100
    expect(rangeMock).toHaveBeenCalledWith(0, 99);
  });

  it("should return empty array when no posts found", async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { email: "test@example.com" },
      expires: "2099-01-01",
    });

    mockFrom.mockImplementation(() => ({
      select: () => ({
        order: () => ({
          range: vi.fn().mockResolvedValue({
            count: 0,
            data: [],
            error: null,
          }),
        }),
      }),
    }));

    const request = new NextRequest("http://localhost:3000/api/posts");
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.data).toEqual([]);
    expect(data.total).toBe(0);
  });

  it("should return 500 on database error", async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { email: "test@example.com" },
      expires: "2099-01-01",
    });

    mockFrom.mockImplementation(() => ({
      select: () => ({
        order: () => ({
          range: vi.fn().mockResolvedValue({
            count: null,
            data: null,
            error: { message: "Database connection failed" },
          }),
        }),
      }),
    }));

    const request = new NextRequest("http://localhost:3000/api/posts");
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe("Database connection failed");
  });
});
