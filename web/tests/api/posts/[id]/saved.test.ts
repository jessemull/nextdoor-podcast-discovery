import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { PATCH } from "@/app/api/posts/[id]/saved/route";

vi.mock("next-auth", () => ({
  getServerSession: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  authOptions: {},
}));

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockFrom = vi.fn() as any;
const mockUpdate = vi.fn().mockReturnThis();
const mockEq = vi.fn().mockReturnThis();
const mockSelect = vi.fn().mockReturnThis();
const mockSingle = vi.fn();

const mockSupabase = {
  from: mockFrom,
};

vi.mock("@/lib/supabase.server", () => ({
  getSupabaseAdmin: () => mockSupabase,
}));

import { getServerSession } from "next-auth";

const createParams = (id: string) => ({
  params: Promise.resolve({ id }),
});

const VALID_ID = "123e4567-e89b-12d3-a456-426614174000";

describe("PATCH /api/posts/[id]/saved", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFrom.mockReturnValue({
      eq: mockEq,
      select: mockSelect,
      update: mockUpdate,
    });
    mockUpdate.mockReturnValue({ eq: mockEq });
    mockEq.mockReturnValue({ select: mockSelect });
    mockSelect.mockReturnValue({ single: mockSingle });
  });

  it("should return 401 when not authenticated", async () => {
    vi.mocked(getServerSession).mockResolvedValue(null);

    const request = new NextRequest(`http://localhost:3000/api/posts/${VALID_ID}/saved`, {
      body: JSON.stringify({ saved: true }),
      method: "PATCH",
    });
    const response = await PATCH(request, createParams(VALID_ID));
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe("Unauthorized");
  });

  it("should return 400 for invalid UUID format", async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { email: "test@example.com" },
    });

    const request = new NextRequest("http://localhost:3000/api/posts/invalid/saved", {
      body: JSON.stringify({ saved: true }),
      method: "PATCH",
    });
    const response = await PATCH(request, createParams("invalid"));
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe("Invalid post ID format");
  });

  it("should return 400 when saved field is missing", async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { email: "test@example.com" },
    });

    const request = new NextRequest(`http://localhost:3000/api/posts/${VALID_ID}/saved`, {
      body: JSON.stringify({}),
      method: "PATCH",
    });
    const response = await PATCH(request, createParams(VALID_ID));
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBeDefined();
  });

  it("should return 400 when saved is not a boolean", async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { email: "test@example.com" },
    });

    const request = new NextRequest(`http://localhost:3000/api/posts/${VALID_ID}/saved`, {
      body: JSON.stringify({ saved: "true" }),
      method: "PATCH",
    });
    const response = await PATCH(request, createParams(VALID_ID));
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBeDefined();
  });

  it("should update saved state and return post when valid", async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { email: "test@example.com" },
    });

    mockSingle.mockResolvedValue({
      data: { id: VALID_ID, saved: true },
      error: null,
    });

    const request = new NextRequest(`http://localhost:3000/api/posts/${VALID_ID}/saved`, {
      body: JSON.stringify({ saved: true }),
      method: "PATCH",
    });
    const response = await PATCH(request, createParams(VALID_ID));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.data.saved).toBe(true);
  });

  it("should return 500 on database error", async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { email: "test@example.com" },
    });

    mockSingle.mockResolvedValue({
      data: null,
      error: { message: "Database error" },
    });

    const request = new NextRequest(`http://localhost:3000/api/posts/${VALID_ID}/saved`, {
      body: JSON.stringify({ saved: true }),
      method: "PATCH",
    });
    const response = await PATCH(request, createParams(VALID_ID));
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe("Database error");
  });
});
