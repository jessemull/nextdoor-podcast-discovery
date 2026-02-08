import { beforeEach, describe, expect, it, vi } from "vitest";

import { GET } from "@/app/api/episodes/route";

vi.mock("next-auth", () => ({
  getServerSession: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  authOptions: {},
}));

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockFrom = vi.fn() as any;
let episodesMockResolve: { data: unknown; error: unknown } = {
  data: [],
  error: null,
};

const mockSupabase = {
  from: mockFrom,
};

vi.mock("@/lib/supabase.server", () => ({
  getSupabaseAdmin: () => mockSupabase,
}));

import { getServerSession } from "next-auth";

describe("GET /api/episodes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    episodesMockResolve = { data: [], error: null };
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          not: vi.fn().mockImplementation(() =>
            Promise.resolve(episodesMockResolve)
          ),
        }),
      }),
    });
  });

  it("should return 401 when not authenticated", async () => {
    vi.mocked(getServerSession).mockResolvedValue(null);

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe("Unauthorized");
  });

  it("should return episode dates when authenticated", async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { email: "test@example.com" },
    });

    episodesMockResolve = {
      data: [
        { episode_date: "2024-01-15" },
        { episode_date: "2024-01-14" },
        { episode_date: "2024-01-15" },
      ],
      error: null,
    };

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.data).toEqual(["2024-01-15", "2024-01-14"]);
  });

  it("should return 500 on database error", async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { email: "test@example.com" },
    });

    episodesMockResolve = {
      data: null,
      error: { code: "PGRST000", message: "Connection failed" },
    };

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe("Database error");
  });
});
