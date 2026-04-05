import { NextRequest, NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { POST } from "@/app/api/posts/bulk/count/route";

vi.mock("@/lib/supabase-server-auth", () => ({
  getSession: vi.fn(),
}));

const mockFrom = vi.fn();
const mockSupabase = { from: mockFrom };

vi.mock("@/lib/supabase.server", () => ({
  getSupabaseAdmin: () => mockSupabase,
}));

vi.mock("@/lib/posts.bulk.server", () => ({
  getPostIdsByQuery: vi.fn(),
}));

import { getPostIdsByQuery } from "@/lib/posts.bulk.server";
import { getSession } from "@/lib/supabase-server-auth";

describe("POST /api/posts/bulk/count", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return 401 when not authenticated", async () => {
    vi.mocked(getSession).mockResolvedValue(null);

    const request = new NextRequest("http://localhost:3000/api/posts/bulk/count", {
      body: JSON.stringify({ query: {} }),
      method: "POST",
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe("Unauthorized");
  });

  it("should return 400 for invalid JSON", async () => {
    vi.mocked(getSession).mockResolvedValue({
      user: { email: "a@b.com", id: "u1" },
    } as never);

    const request = new NextRequest("http://localhost:3000/api/posts/bulk/count", {
      body: "not-json",
      method: "POST",
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe("Invalid JSON body");
  });

  it("should return 400 when body fails validation", async () => {
    vi.mocked(getSession).mockResolvedValue({
      user: { email: "a@b.com", id: "u1" },
    } as never);

    const request = new NextRequest("http://localhost:3000/api/posts/bulk/count", {
      body: JSON.stringify({}),
      method: "POST",
    });

    const response = await POST(request);
    expect(response.status).toBe(400);
  });

  it("should return count when getPostIdsByQuery succeeds", async () => {
    vi.mocked(getSession).mockResolvedValue({
      user: { email: "a@b.com", id: "u1" },
    } as never);
    vi.mocked(getPostIdsByQuery).mockResolvedValue({
      error: null,
      postIds: ["a".repeat(36), "b".repeat(36)],
    });

    const request = new NextRequest("http://localhost:3000/api/posts/bulk/count", {
      body: JSON.stringify({ query: { sort: "score" } }),
      method: "POST",
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.data).toEqual({ count: 2 });
  });

  it("should propagate error response from getPostIdsByQuery", async () => {
    vi.mocked(getSession).mockResolvedValue({
      user: { email: "a@b.com", id: "u1" },
    } as never);
    vi.mocked(getPostIdsByQuery).mockResolvedValue({
      error: NextResponse.json({ error: "DB error" }, { status: 500 }),
      postIds: [],
    });

    const request = new NextRequest("http://localhost:3000/api/posts/bulk/count", {
      body: JSON.stringify({ query: {} }),
      method: "POST",
    });

    const response = await POST(request);
    expect(response.status).toBe(500);
  });
});
