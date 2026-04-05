/** @vitest-environment node */

import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockCreateSupabaseAuthClientForMiddleware,
  mockGetUser,
} = vi.hoisted(() => {
  const getUser = vi.fn();
  const createSupabaseAuthClientForMiddleware = vi.fn(() => ({
    auth: {
      getUser,
    },
  }));
  return {
    mockCreateSupabaseAuthClientForMiddleware: createSupabaseAuthClientForMiddleware,
    mockGetUser: getUser,
  };
});

vi.mock("@/lib/supabase-server-auth", () => ({
  createSupabaseAuthClientForMiddleware: mockCreateSupabaseAuthClientForMiddleware,
}));

import middleware from "@/middleware";

describe("middleware", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockResolvedValue({ data: { user: null } });
  });

  it("should pass through static asset paths without Supabase", async () => {
    const request = new NextRequest("http://localhost:3000/favicon.ico");
    const response = await middleware(request);

    expect(response.status).toBe(200);
    expect(mockCreateSupabaseAuthClientForMiddleware).not.toHaveBeenCalled();
  });

  it("should pass through public paths without session check", async () => {
    const request = new NextRequest("http://localhost:3000/about");
    const response = await middleware(request);

    expect(response.status).toBe(200);
    expect(mockCreateSupabaseAuthClientForMiddleware).not.toHaveBeenCalled();
  });

  it("should pass through public path prefixes", async () => {
    const request = new NextRequest(
      "http://localhost:3000/episodes/my-episode-slug"
    );
    const response = await middleware(request);

    expect(response.status).toBe(200);
    expect(mockCreateSupabaseAuthClientForMiddleware).not.toHaveBeenCalled();
  });

  it("should pass through auth confirm without session check", async () => {
    const request = new NextRequest(
      "http://localhost:3000/auth/confirm?token_hash=abc&type=recovery"
    );
    const response = await middleware(request);

    expect(response.status).toBe(200);
    expect(mockCreateSupabaseAuthClientForMiddleware).not.toHaveBeenCalled();
  });

  it("should redirect to login when no user on protected non-API route", async () => {
    const request = new NextRequest("http://localhost:3000/admin/settings");
    const response = await middleware(request);

    expect(response.status).toBe(307);
    const loc = response.headers.get("location");
    expect(loc).toContain("/login");
    expect(loc).toContain("returnTo");
  });

  it("should not redirect API routes when unauthenticated", async () => {
    const request = new NextRequest("http://localhost:3000/api/posts");
    const response = await middleware(request);

    expect(response.status).toBe(200);
    expect(mockCreateSupabaseAuthClientForMiddleware).toHaveBeenCalled();
  });

  it("should pass through when getUser returns a user", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: "user-1" } },
    });

    const request = new NextRequest("http://localhost:3000/admin");
    const response = await middleware(request);

    expect(response.status).toBe(200);
  });

  it("should treat invalid refresh token errors as signed out", async () => {
    mockGetUser.mockRejectedValue({
      message: "Invalid Refresh Token",
    });

    const request = new NextRequest("http://localhost:3000/admin");
    const response = await middleware(request);

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toContain("/login");
  });

  it("should rethrow non-refresh-token auth errors", async () => {
    mockGetUser.mockRejectedValue({
      message: "Unexpected auth failure",
    });

    const request = new NextRequest("http://localhost:3000/admin");

    await expect(middleware(request)).rejects.toMatchObject({
      message: "Unexpected auth failure",
    });
  });
});
