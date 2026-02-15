import { beforeEach, describe, expect, it, vi } from "vitest";

import { GET } from "@/app/api/posts/[id]/route";

// Mock Auth0
vi.mock("@/lib/auth0", () => ({
  auth0: { getSession: vi.fn() },
}));

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockFrom = vi.fn() as any;

const mockSupabase = {
  from: mockFrom,
};

vi.mock("@/lib/supabase.server", () => ({
  getSupabaseAdmin: () => mockSupabase,
}));

import { auth0 } from "@/lib/auth0";

const createParams = (id: string) => ({
  params: Promise.resolve({ id }),
});

describe("GET /api/posts/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return 401 when not authenticated", async () => {
    vi.mocked(auth0.getSession).mockResolvedValue(null);

    const response = await GET(
      new Request("http://localhost:3000/api/posts/123e4567-e89b-12d3-a456-426614174000"),
      createParams("123e4567-e89b-12d3-a456-426614174000")
    );
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe("Unauthorized");
  });

  it("should return 400 for invalid UUID format", async () => {
    vi.mocked(auth0.getSession).mockResolvedValue({
      user: { email: "test@example.com" },
    });

    const response = await GET(
      new Request("http://localhost:3000/api/posts/invalid"),
      createParams("invalid")
    );
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe("Invalid post ID format");
  });

  it("should return post with scores when found", async () => {
    vi.mocked(auth0.getSession).mockResolvedValue({
      user: { email: "test@example.com" },
    });

    const postId = "123e4567-e89b-12d3-a456-426614174000";
    const mockPost = {
      id: postId,
      text: "Test post",
      neighborhood: { id: "n1", name: "Test", slug: "test" },
    };
    const mockScore = {
      id: "score-1",
      post_id: postId,
      final_score: 8,
      scores: { absurdity: 9 },
      categories: ["humor"],
      summary: "Funny",
    };

    let callCount = 0;
    mockFrom.mockImplementation((table: string) => {
      if (table === "posts") {
        return {
          eq: vi.fn().mockReturnThis(),
          select: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: mockPost, error: null }),
        };
      }
      if (table === "llm_scores") {
        return {
          eq: vi.fn().mockReturnThis(),
          select: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: mockScore, error: null }),
        };
      }
      return {};
    });

    const response = await GET(
      new Request(`http://localhost:3000/api/posts/${postId}`),
      createParams(postId)
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.data.id).toBe(postId);
    expect(data.data.text).toBe("Test post");
    expect(data.data.llm_scores?.final_score).toBe(8);
  });

  it("should return 404 when post not found", async () => {
    vi.mocked(auth0.getSession).mockResolvedValue({
      user: { email: "test@example.com" },
    });

    const postId = "123e4567-e89b-12d3-a456-426614174000";
    mockFrom.mockReturnValue({
      eq: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: null,
        error: { code: "PGRST116" },
      }),
    });

    const response = await GET(
      new Request(`http://localhost:3000/api/posts/${postId}`),
      createParams(postId)
    );
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toBe("Not found");
  });
});
