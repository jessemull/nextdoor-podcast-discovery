import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { PATCH } from "@/app/api/posts/[id]/used/route";

// Mock next-auth
vi.mock("next-auth", () => ({
  getServerSession: vi.fn(),
}));

// Mock auth options
vi.mock("@/lib/auth", () => ({
  authOptions: {},
}));

// Mock Supabase
const mockSingle = vi.fn();
const mockSelect = vi.fn(() => ({ single: mockSingle }));
const mockEq = vi.fn(() => ({ select: mockSelect }));
const mockUpdate = vi.fn(() => ({ eq: mockEq }));
const mockFrom = vi.fn(() => ({ update: mockUpdate }));
const mockSupabase = {
  from: mockFrom,
};

vi.mock("@/lib/supabase.server", () => ({
  getSupabaseAdmin: () => mockSupabase,
}));

import { getServerSession } from "next-auth";

// Helper to create route params
const createParams = (id: string) => ({
  params: Promise.resolve({ id }),
});

describe("PATCH /api/posts/[id]/used", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return 401 when not authenticated", async () => {
    vi.mocked(getServerSession).mockResolvedValue(null);

    const request = new NextRequest("http://localhost:3000/api/posts/123/used", {
      body: JSON.stringify({ used: true }),
      method: "PATCH",
    });

    const response = await PATCH(request, createParams("123"));
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe("Unauthorized");
  });

  it("should return 400 for invalid UUID format", async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { email: "test@example.com" },
      expires: "2099-01-01",
    });

    const request = new NextRequest("http://localhost:3000/api/posts/invalid-id/used", {
      body: JSON.stringify({ used: true }),
      method: "PATCH",
    });

    const response = await PATCH(request, createParams("invalid-id"));
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe("Invalid post ID format");
  });

  it("should return 400 when used field is missing", async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { email: "test@example.com" },
      expires: "2099-01-01",
    });

    const request = new NextRequest("http://localhost:3000/api/posts/123e4567-e89b-12d3-a456-426614174000/used", {
      body: JSON.stringify({}),
      method: "PATCH",
    });

    const response = await PATCH(request, createParams("123e4567-e89b-12d3-a456-426614174000"));
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe("Missing required field: used (boolean)");
  });

  it("should return 400 when used field is not a boolean", async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { email: "test@example.com" },
      expires: "2099-01-01",
    });

    const request = new NextRequest("http://localhost:3000/api/posts/123e4567-e89b-12d3-a456-426614174000/used", {
      body: JSON.stringify({ used: "true" }),
      method: "PATCH",
    });

    const response = await PATCH(request, createParams("123e4567-e89b-12d3-a456-426614174000"));
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe("Missing required field: used (boolean)");
  });

  it("should return 400 for invalid episode_date format", async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { email: "test@example.com" },
      expires: "2099-01-01",
    });

    const request = new NextRequest("http://localhost:3000/api/posts/123e4567-e89b-12d3-a456-426614174000/used", {
      body: JSON.stringify({ episode_date: "02/05/2026", used: true }),
      method: "PATCH",
    });

    const response = await PATCH(request, createParams("123e4567-e89b-12d3-a456-426614174000"));
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe("Invalid episode_date format (expected YYYY-MM-DD)");
  });

  it("should successfully mark post as used", async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { email: "test@example.com" },
      expires: "2099-01-01",
    });

    const mockPost = {
      episode_date: "2026-02-05",
      id: "123e4567-e89b-12d3-a456-426614174000",
      used_on_episode: true,
    };

    mockSingle.mockResolvedValue({ data: mockPost, error: null });

    const request = new NextRequest("http://localhost:3000/api/posts/123e4567-e89b-12d3-a456-426614174000/used", {
      body: JSON.stringify({ episode_date: "2026-02-05", used: true }),
      method: "PATCH",
    });

    const response = await PATCH(request, createParams("123e4567-e89b-12d3-a456-426614174000"));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.data).toEqual(mockPost);
    expect(mockUpdate).toHaveBeenCalledWith({
      episode_date: "2026-02-05",
      used_on_episode: true,
    });
  });

  it("should use today's date when marking as used without episode_date", async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { email: "test@example.com" },
      expires: "2099-01-01",
    });

    const today = new Date().toISOString().split("T")[0];
    const mockPost = {
      episode_date: today,
      id: "123e4567-e89b-12d3-a456-426614174000",
      used_on_episode: true,
    };

    mockSingle.mockResolvedValue({ data: mockPost, error: null });

    const request = new NextRequest("http://localhost:3000/api/posts/123e4567-e89b-12d3-a456-426614174000/used", {
      body: JSON.stringify({ used: true }),
      method: "PATCH",
    });

    const response = await PATCH(request, createParams("123e4567-e89b-12d3-a456-426614174000"));

    expect(response.status).toBe(200);
    expect(mockUpdate).toHaveBeenCalledWith({
      episode_date: today,
      used_on_episode: true,
    });
  });

  it("should return 404 when post not found", async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { email: "test@example.com" },
      expires: "2099-01-01",
    });

    mockSingle.mockResolvedValue({ data: null, error: null });

    const request = new NextRequest("http://localhost:3000/api/posts/123e4567-e89b-12d3-a456-426614174000/used", {
      body: JSON.stringify({ used: true }),
      method: "PATCH",
    });

    const response = await PATCH(request, createParams("123e4567-e89b-12d3-a456-426614174000"));
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toBe("Post not found");
  });

  it("should return 500 on database error", async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { email: "test@example.com" },
      expires: "2099-01-01",
    });

    mockSingle.mockResolvedValue({ data: null, error: { message: "Database error" } });

    const request = new NextRequest("http://localhost:3000/api/posts/123e4567-e89b-12d3-a456-426614174000/used", {
      body: JSON.stringify({ used: true }),
      method: "PATCH",
    });

    const response = await PATCH(request, createParams("123e4567-e89b-12d3-a456-426614174000"));
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe("Database error");
  });
});
