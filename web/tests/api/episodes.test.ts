import { describe, expect, it, vi } from "vitest";

import { GET } from "@/app/api/episodes/route";

// Mock auth
vi.mock("@/lib/supabase-server-auth", () => ({
  getSession: vi.fn(),
}));

import { getSession } from "@/lib/supabase-server-auth";

describe("GET /api/episodes", () => {
  it("should return 401 when not authenticated", async () => {
    vi.mocked(getSession).mockResolvedValue(null);

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe("Unauthorized");
  });

  it("should return empty data when authenticated (episode_date removed)", async () => {
    vi.mocked(getSession).mockResolvedValue({
      user: { email: "test@example.com", id: "test-user-id" },
    });

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.data).toEqual([]);
  });
});
