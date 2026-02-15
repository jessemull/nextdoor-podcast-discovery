import { beforeEach, describe, expect, it, vi } from "vitest";

import { GET } from "@/app/api/neighborhoods/route";

// Mock Auth0
vi.mock("@/lib/auth0", () => ({
  auth0: { getSession: vi.fn() },
}));

// Mock Supabase — client chain is dynamic; mocks use "as any" for fluent test setup.
const mockFrom = vi.fn() as any;
let neighborhoodsMockResolve: { data: unknown; error: unknown } = {
  data: [],
  error: null,
};

const mockSupabase = {
  from: mockFrom,
};

vi.mock("@/lib/supabase.server", () => ({
  getSupabaseAdmin: () => mockSupabase,
}));

import { auth0 } from "@/lib/auth0";

describe("GET /api/neighborhoods", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    neighborhoodsMockResolve = { data: [], error: null };
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockImplementation(() =>
            Promise.resolve(neighborhoodsMockResolve)
          ),
        }),
      }),
    });
  });

  it("should return 401 when not authenticated", async () => {
    vi.mocked(auth0.getSession).mockResolvedValue(null);

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe("Unauthorized");
  });

  it("should return neighborhoods when authenticated", async () => {
    vi.mocked(auth0.getSession).mockResolvedValue({
      user: { email: "test@example.com" },
    });

    neighborhoodsMockResolve = {
      data: [
        { id: "n1", name: "Downtown", slug: "downtown" },
        { id: "n2", name: "Oakland", slug: "oakland" },
      ],
      error: null,
    };

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.data).toHaveLength(2);
    expect(data.data[0].name).toBe("Downtown");
  });

  it("should return 500 on database error", async () => {
    vi.mocked(auth0.getSession).mockResolvedValue({
      user: { email: "test@example.com" },
    });

    neighborhoodsMockResolve = {
      data: null,
      error: { code: "PGRST000", message: "Connection failed" },
    };

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe("Database error");
  });
});
