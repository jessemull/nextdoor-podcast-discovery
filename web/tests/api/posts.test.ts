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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockRpc = vi.fn() as any;

const mockSupabase = {
  from: mockFrom,
  rpc: mockRpc,
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

  it("should return posts when authenticated using RPC", async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { email: "test@example.com" },
      expires: "2099-01-01",
    });

    const mockScoresData = [
      {
        post_id: "post-1",
        final_score: 10,
        llm_score_id: "score-1",
        scores: { absurdity: 5.0, drama: 3.0 },
        categories: ["humor"],
        summary: "Test summary",
        model_version: "claude-3-haiku-20240307",
        llm_created_at: "2024-01-01T00:00:00Z",
      },
      {
        post_id: "post-2",
        final_score: 8,
        llm_score_id: "score-2",
        scores: { absurdity: 4.0, drama: 5.0 },
        categories: ["drama"],
        summary: null,
        model_version: "claude-3-haiku-20240307",
        llm_created_at: "2024-01-01T00:00:00Z",
      },
    ];

    const mockPosts = [
      { id: "post-1", text: "Post 1", neighborhood: { name: "Test" } },
      { id: "post-2", text: "Post 2", neighborhood: { name: "Test" } },
    ];

    // Mock settings query for active config
    const settingsSelect = vi.fn().mockReturnThis();
    const settingsEq = vi.fn().mockReturnThis();
    const settingsSingle = vi.fn().mockResolvedValue({
      data: { value: "config-1" },
      error: null,
    });

    settingsSelect.mockReturnValue({
      eq: settingsEq,
    });
    settingsEq.mockReturnValue({
      single: settingsSingle,
    });

    // Mock RPC calls
    mockRpc.mockImplementation((fnName: string) => {
      if (fnName === "get_posts_with_scores") {
        return Promise.resolve({
          data: mockScoresData,
          error: null,
        });
      }
      if (fnName === "get_posts_with_scores_count") {
        return Promise.resolve({
          data: 2,
          error: null,
        });
      }
      return Promise.resolve({ data: null, error: null });
    });

    // Mock posts query
    const postsSelect = vi.fn().mockReturnThis();
    const postsIn = vi.fn().mockResolvedValue({
      data: mockPosts,
      error: null,
    });

    postsSelect.mockReturnValue({
      in: postsIn,
    });

    mockFrom.mockImplementation((table: string) => {
      if (table === "settings") {
        return { select: settingsSelect };
      }
      if (table === "posts") {
        return { select: postsSelect };
      }
      return {};
    });

    const request = new NextRequest("http://localhost:3000/api/posts?limit=10&sort=score");
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.data).toHaveLength(2);
    expect(data.total).toBe(2);
    expect(mockRpc).toHaveBeenCalledWith("get_posts_with_scores", expect.objectContaining({
      p_weight_config_id: "config-1",
      p_limit: 10,
    }));
  });

  it("should return error when no active config found", async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { email: "test@example.com" },
      expires: "2099-01-01",
    });

    // Mock settings query - no active config
    const settingsSelect = vi.fn().mockReturnThis();
    const settingsEq = vi.fn().mockReturnThis();
    const settingsSingle = vi.fn().mockResolvedValue({
      data: null,
      error: null,
    });

    settingsSelect.mockReturnValue({
      eq: settingsEq,
    });
    settingsEq.mockReturnValue({
      single: settingsSingle,
    });

    // Mock weight_configs query - no active configs
    // Chain: .select("id").eq("is_active", true).limit(1).single()
    const configsLimit = vi.fn().mockReturnValue({
      single: vi.fn().mockResolvedValue({
        data: null,
        error: { message: "Not found" },
      }),
    });
    const configsEq = vi.fn().mockReturnValue({
      limit: configsLimit,
    });

    // Mock check for any configs: .select("id, name").limit(1)
    const allConfigsLimit = vi.fn().mockResolvedValue({
      data: [],
      error: null,
    });

    mockFrom.mockImplementation((table: string) => {
      if (table === "settings") {
        return { select: settingsSelect };
      }
      if (table === "weight_configs") {
        return {
          select: (arg?: string) => {
            if (arg === "id, name") {
              return { limit: allConfigsLimit };
            }
            // .select("id").eq("is_active", true).limit(1).single()
            if (arg === "id") {
              return { eq: configsEq };
            }
            return { eq: configsEq };
          },
        };
      }
      return {};
    });

    const request = new NextRequest("http://localhost:3000/api/posts");
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(503);
    expect(data.error).toBe("No weight configs found");
    expect(data.details).toContain("create a weight configuration");
  });

  it("should return 400 for invalid query params", async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { email: "test@example.com" },
      expires: "2099-01-01",
    });

    const request = new NextRequest(
      "http://localhost:3000/api/posts?limit=invalid&sort=date"
    );
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBeDefined();
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

    const request = new NextRequest("http://localhost:3000/api/posts?limit=500&sort=date");
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

    const request = new NextRequest("http://localhost:3000/api/posts?sort=date");
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

    const request = new NextRequest("http://localhost:3000/api/posts?sort=date");
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe("Database error");
  });
});
