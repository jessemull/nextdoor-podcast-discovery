import { beforeEach, describe, expect, it, vi } from "vitest";

import { GET } from "@/app/api/stats/route";

// Mock next-auth
vi.mock("next-auth", () => ({
  getServerSession: vi.fn(),
}));

// Mock auth options
vi.mock("@/lib/auth", () => ({
  authOptions: {},
}));

// Mock Supabase
const mockSupabase = {
  from: vi.fn(),
  rpc: vi.fn().mockResolvedValue({ data: 0 }),
};

vi.mock("@/lib/supabase.server", () => ({
  getSupabaseAdmin: () => mockSupabase,
}));

import { getServerSession } from "next-auth";

describe("GET /api/stats", () => {
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

  it("should return stats when authenticated", async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { email: "test@example.com" },
      expires: "2099-01-01",
    });

    const mockTopicFrequencies = [
      { category: "humor", count_30d: 25, last_updated: "2026-02-05" },
      { category: "drama", count_30d: 15, last_updated: "2026-02-05" },
    ];

    mockSupabase.from.mockImplementation((table: string) => {
      if (table === "posts") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ count: 5, error: null }),
          }),
        };
      }
      if (table === "llm_scores") {
        return {
          select: vi.fn().mockResolvedValue({ count: 45, error: null }),
        };
      }
      if (table === "topic_frequencies") {
        return {
          select: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({
              data: mockTopicFrequencies,
              error: null,
            }),
          }),
        };
      }
      return { select: vi.fn() };
    });

    // Need to handle the parallel Promise.all properly
    // Simplify by mocking the entire flow

    mockSupabase.from.mockImplementation((table: string) => {
      const baseSelect = vi.fn();

      if (table === "posts") {
        const selectReturn = {
          count: 50,
          error: null,
          eq: vi.fn().mockResolvedValue({ count: 5, error: null }),
          gte: vi.fn().mockResolvedValue({ count: 12, error: null }),
          then: (resolve: (v: { count: number; error: null }) => void) =>
            resolve({ count: 50, error: null }),
        };
        baseSelect.mockReturnValue(selectReturn);
        return { select: baseSelect };
      }

      if (table === "llm_scores") {
        baseSelect.mockResolvedValue({ count: 45, error: null });
        return { select: baseSelect };
      }

      if (table === "topic_frequencies") {
        baseSelect.mockReturnValue({
          order: vi.fn().mockResolvedValue({
            data: mockTopicFrequencies,
            error: null,
          }),
        });
        return { select: baseSelect };
      }

      if (table === "settings") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { value: "2025-02-07T02:00:00Z" },
                error: null,
              }),
            }),
          }),
        };
      }

      return { select: baseSelect };
    });

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toHaveProperty("posts_total");
    expect(data).toHaveProperty("posts_scored");
    expect(data).toHaveProperty("posts_unscored");
    expect(data).toHaveProperty("posts_used");
    expect(data).toHaveProperty("top_categories");
  });

  it("should return 500 when posts query fails", async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { email: "test@example.com" },
      expires: "2099-01-01",
    });

    // First call to posts (total count) fails
    let postsCallCount = 0;

    mockSupabase.from.mockImplementation((table: string) => {
      if (table === "posts") {
        postsCallCount++;
        if (postsCallCount === 1) {
          // First posts call - fail it
          return {
            select: vi.fn().mockResolvedValue({
              count: null,
              error: { message: "Posts query failed" },
            }),
          };
        }
        // Second and third posts calls (used count, last24h) - need eq and gte
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ count: 0, error: null }),
            gte: vi.fn().mockResolvedValue({ count: 0, error: null }),
          }),
        };
      }
      if (table === "llm_scores") {
        return {
          select: vi.fn().mockResolvedValue({ count: 0, error: null }),
        };
      }
      if (table === "topic_frequencies") {
        return {
          select: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({ data: [], error: null }),
          }),
        };
      }
      if (table === "settings") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: null, error: null }),
            }),
          }),
        };
      }
      return { select: vi.fn() };
    });

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe("Database error");
  });

  it("should return 500 when scores query fails", async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { email: "test@example.com" },
      expires: "2099-01-01",
    });

    // Track call count to differentiate between posts calls
    let postsCallCount = 0;

    mockSupabase.from.mockImplementation((table: string) => {
      if (table === "posts") {
        postsCallCount++;
        if (postsCallCount === 1) {
          return {
            select: vi.fn().mockResolvedValue({ count: 50, error: null }),
          };
        }
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ count: 5, error: null }),
            gte: vi.fn().mockResolvedValue({ count: 5, error: null }),
          }),
        };
      }

      if (table === "llm_scores") {
        return {
          select: vi.fn().mockResolvedValue({
            count: null,
            error: { message: "Scores query failed" },
          }),
        };
      }

      if (table === "topic_frequencies") {
        return {
          select: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({ data: [], error: null }),
          }),
        };
      }
      if (table === "settings") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: null, error: null }),
            }),
          }),
        };
      }

      return { select: vi.fn() };
    });

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe("Database error");
  });

  it("should calculate unscored correctly", async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { email: "test@example.com" },
      expires: "2099-01-01",
    });

    // Simple mock that returns predictable values
    mockSupabase.from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ count: 10, error: null }),
        order: vi.fn().mockResolvedValue({ data: [], error: null }),
      }),
    });

    // Order in Promise.all: posts (total), llm_scores, posts (used), topic_frequencies, posts (last24h), settings
    let postsCallCount = 0;
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === "posts") {
        postsCallCount++;
        if (postsCallCount === 1) {
          return { select: vi.fn().mockResolvedValue({ count: 100, error: null }) };
        }
        if (postsCallCount === 2) {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ count: 10, error: null }),
            }),
          };
        }
        return {
          select: vi.fn().mockReturnValue({
            gte: vi.fn().mockResolvedValue({ count: 5, error: null }),
          }),
        };
      }
      if (table === "llm_scores") {
        return { select: vi.fn().mockResolvedValue({ count: 75, error: null }) };
      }
      if (table === "topic_frequencies") {
        return {
          select: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({ data: [], error: null }),
          }),
        };
      }
      if (table === "settings") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { value: "2025-02-07T02:00:00Z" },
                error: null,
              }),
            }),
          }),
        };
      }
      return { select: vi.fn() };
    });

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.posts_total).toBe(100);
    expect(data.posts_scored).toBe(75);
    expect(data.posts_unscored).toBe(25); // 100 - 75
    expect(data.posts_used).toBe(10);
  });
});
