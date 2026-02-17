import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { POST } from "@/app/api/posts/bulk/route";

vi.mock("@/lib/auth0", () => ({
  auth0: { getSession: vi.fn() },
}));

vi.mock("@/lib/log.server", () => ({
  logError: vi.fn(),
}));

const mockFrom = vi.fn();
const mockSupabase = { from: mockFrom };

vi.mock("@/lib/supabase.server", () => ({
  getSupabaseAdmin: () => mockSupabase,
}));

vi.mock("@/lib/posts.bulk.server", () => ({
  getPostIdsByQuery: vi.fn(),
}));

import { auth0 } from "@/lib/auth0";
import { getPostIdsByQuery } from "@/lib/posts.bulk.server";

const POST_ID_1 = "123e4567-e89b-12d3-a456-426614174001";
const POST_ID_2 = "123e4567-e89b-12d3-a456-426614174002";
const POST_ID_3 = "123e4567-e89b-12d3-a456-426614174003";

describe("POST /api/posts/bulk", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return 401 when not authenticated", async () => {
    vi.mocked(auth0.getSession).mockResolvedValue(null);

    const request = new NextRequest("http://localhost:3000/api/posts/bulk", {
      body: JSON.stringify({
        action: "mark_used",
        post_ids: [POST_ID_1],
      }),
      method: "POST",
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe("Unauthorized");
  });

  it("should return 400 when body is invalid", async () => {
    vi.mocked(auth0.getSession).mockResolvedValue({
      user: { email: "test@example.com" },
      expires: "2099-01-01",
    });

    const request = new NextRequest("http://localhost:3000/api/posts/bulk", {
      body: JSON.stringify({
        action: "mark_used",
      }),
      method: "POST",
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBeDefined();
  });

  describe("action: reprocess", () => {
    it("should return jobs_queued and skipped when posts have url", async () => {
      vi.mocked(auth0.getSession).mockResolvedValue({
        user: { email: "user@example.com" },
        expires: "2099-01-01",
      });

      const postsWithUrl = [
        { id: POST_ID_1, url: "https://nextdoor.com/p/abc123" },
        { id: POST_ID_2, url: "https://nextdoor.com/p/def456" },
      ];

      const postsChain1 = {
        in: vi.fn().mockResolvedValue({ data: postsWithUrl, error: null }),
        select: vi.fn().mockReturnThis(),
      };
      Object.assign(postsChain1, { select: () => postsChain1 });

      mockFrom.mockImplementation((table: string) => {
        if (table === "posts") {
          return postsChain1;
        }
        if (table === "background_jobs") {
          return {
            insert: vi.fn().mockResolvedValue({ error: null }),
          };
        }
        return {};
      });

      const request = new NextRequest("http://localhost:3000/api/posts/bulk", {
        body: JSON.stringify({
          action: "reprocess",
          post_ids: [POST_ID_1, POST_ID_2],
        }),
        method: "POST",
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data).toEqual({
        jobs_queued: 2,
        skipped: 0,
      });
      expect(mockFrom).toHaveBeenCalledWith("background_jobs");
      expect(mockFrom).toHaveBeenCalledWith("posts");
    });

    it("should skip posts without url and return skipped count", async () => {
      vi.mocked(auth0.getSession).mockResolvedValue({
        user: { email: "user@example.com" },
        expires: "2099-01-01",
      });

      const postsWithUrl = [
        { id: POST_ID_1, url: "https://nextdoor.com/p/abc123" },
        { id: POST_ID_2, url: null },
        { id: POST_ID_3, url: "" },
      ];

      const postsChain2 = {
        in: vi.fn().mockResolvedValue({ data: postsWithUrl, error: null }),
        select: vi.fn().mockReturnThis(),
      };
      Object.assign(postsChain2, { select: () => postsChain2 });

      mockFrom.mockImplementation((table: string) => {
        if (table === "posts") {
          return postsChain2;
        }
        if (table === "background_jobs") {
          return {
            insert: vi.fn().mockResolvedValue({ error: null }),
          };
        }
        return {};
      });

      const request = new NextRequest("http://localhost:3000/api/posts/bulk", {
        body: JSON.stringify({
          action: "reprocess",
          post_ids: [POST_ID_1, POST_ID_2, POST_ID_3],
        }),
        method: "POST",
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data).toEqual({
        jobs_queued: 1,
        skipped: 2,
      });
    });

    it("should return jobs_queued 0 and skipped 0 when postIds is empty", async () => {
      vi.mocked(auth0.getSession).mockResolvedValue({
        user: { email: "user@example.com" },
        expires: "2099-01-01",
      });

      vi.mocked(getPostIdsByQuery).mockResolvedValue({ postIds: [] });

      const request = new NextRequest("http://localhost:3000/api/posts/bulk", {
        body: JSON.stringify({
          action: "reprocess",
          apply_to_query: true,
          query: { sort: "score", sortOrder: "desc" },
        }),
        method: "POST",
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data).toEqual({
        jobs_queued: 0,
        skipped: 0,
      });
    });
  });
});
