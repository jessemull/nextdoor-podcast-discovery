import { describe, expect, it, vi } from "vitest";

import { GET } from "@/app/api/episodes/route";

// Mock Auth0
vi.mock("@/lib/auth0", () => ({
  auth0: { getSession: vi.fn() },
}));

import { auth0 } from "@/lib/auth0";

describe("GET /api/episodes", () => {
  it("should return 401 when not authenticated", async () => {
    vi.mocked(auth0.getSession).mockResolvedValue(null);

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe("Unauthorized");
  });

  it("should return empty data when authenticated (episode_date removed)", async () => {
    vi.mocked(auth0.getSession).mockResolvedValue({
      user: { email: "test@example.com" },
    });

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.data).toEqual([]);
  });
});
