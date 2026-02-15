import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { GET, PUT } from "@/app/api/settings/route";

// Mock Auth0
vi.mock("@/lib/auth0", () => ({
  auth0: { getSession: vi.fn() },
}));

// Mock Supabase — client chain is dynamic; mocks use "as any" for fluent test setup.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockFrom = vi.fn() as any;

const mockSupabase = {
  from: mockFrom,
};

vi.mock("@/lib/supabase.server", () => ({
  getSupabaseAdmin: () => mockSupabase,
}));

import { auth0 } from "@/lib/auth0";

describe("GET /api/settings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return 401 when not authenticated", async () => {
    vi.mocked(auth0.getSession).mockResolvedValue(null);

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe("Unauthorized");
  });

  it("should return settings with active weight config", async () => {
    vi.mocked(auth0.getSession).mockResolvedValue({
      user: { email: "test@example.com" },
      expires: "2099-01-01",
    });

    const mockActiveConfig = {
      id: "config-1",
      weights: {
        absurdity: 2.0,
        drama: 1.5,
        discussion_spark: 1.0,
        emotional_intensity: 1.2,
        news_value: 1.0,
      },
    };

    const mockSearchDefaults = {
      similarity_threshold: 0.2,
    };

    // Mock settings query for active_weight_config_id
    const mockSettingsSelect = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: { value: "config-1" },
          error: null,
        }),
      }),
    });

    // Mock weight_configs query
    const mockConfigsSelect = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: mockActiveConfig,
          error: null,
        }),
      }),
    });

    // Mock search_defaults query
    const mockSearchDefaultsSelect = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: { value: mockSearchDefaults },
          error: null,
        }),
      }),
    });

    mockFrom.mockImplementation((table: string) => {
      if (table === "settings") {
        return { select: mockSettingsSelect };
      }
      if (table === "weight_configs") {
        return { select: mockConfigsSelect };
      }
      return { select: vi.fn() };
    });

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.data.ranking_weights).toEqual(mockActiveConfig.weights);
    expect(data.data.search_defaults).toEqual(mockSearchDefaults);
  });

  it("should return default weights when no active config", async () => {
    vi.mocked(auth0.getSession).mockResolvedValue({
      user: { email: "test@example.com" },
      expires: "2099-01-01",
    });

    // Mock settings query - no active config
    const mockSettingsSelect = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: null,
          error: null,
        }),
      }),
    });

    // Mock search_defaults query
    const mockSearchDefaultsSelect = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: { value: { similarity_threshold: 0.2 } },
          error: null,
        }),
      }),
    });

    mockFrom.mockImplementation((table: string) => {
      if (table === "settings") {
        return { select: mockSettingsSelect };
      }
      return { select: vi.fn() };
    });

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    // Should have default weights structure
    expect(data.data.ranking_weights).toBeDefined();
    expect(data.data.search_defaults).toBeDefined();
  });

  it("should handle database errors gracefully", async () => {
    vi.mocked(auth0.getSession).mockResolvedValue({
      user: { email: "test@example.com" },
      expires: "2099-01-01",
    });

    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockRejectedValue(new Error("Database error")),
        }),
      }),
    });

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe("Internal server error");
  });
});

describe("PUT /api/settings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return 401 when not authenticated", async () => {
    vi.mocked(auth0.getSession).mockResolvedValue(null);

    const request = new NextRequest("http://localhost:3000/api/settings", {
      body: JSON.stringify({ search_defaults: { similarity_threshold: 0.3 } }),
      method: "PUT",
    });

    const response = await PUT(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe("Unauthorized");
  });

  it("should update search defaults successfully", async () => {
    vi.mocked(auth0.getSession).mockResolvedValue({
      user: { email: "test@example.com" },
      expires: "2099-01-01",
    });

    const mockUpsert = vi.fn().mockResolvedValue({
      data: { key: "search_defaults", value: { similarity_threshold: 0.3 } },
      error: null,
    });

    mockFrom.mockReturnValue({
      upsert: mockUpsert,
    });

    const request = new NextRequest("http://localhost:3000/api/settings", {
      body: JSON.stringify({ search_defaults: { similarity_threshold: 0.3 } }),
      method: "PUT",
    });

    const response = await PUT(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.data.success).toBe(true);
    expect(mockUpsert).toHaveBeenCalledWith(
      { key: "search_defaults", value: { similarity_threshold: 0.3 } },
      { onConflict: "key" }
    );
  });

  it("should return 400 for invalid similarity_threshold", async () => {
    vi.mocked(auth0.getSession).mockResolvedValue({
      user: { email: "test@example.com" },
      expires: "2099-01-01",
    });

    const request = new NextRequest("http://localhost:3000/api/settings", {
      body: JSON.stringify({ search_defaults: { similarity_threshold: 1.5 } }),
      method: "PUT",
    });

    const response = await PUT(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBeDefined();
    expect(
      data.error.includes("similarity_threshold") ||
        data.error.includes("less than or equal to 1")
    ).toBe(true);
  });

  it("should return 400 for missing search_defaults", async () => {
    vi.mocked(auth0.getSession).mockResolvedValue({
      user: { email: "test@example.com" },
      expires: "2099-01-01",
    });

    const request = new NextRequest("http://localhost:3000/api/settings", {
      body: JSON.stringify({}),
      method: "PUT",
    });

    const response = await PUT(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain("search_defaults");
  });

  it("should handle database errors", async () => {
    vi.mocked(auth0.getSession).mockResolvedValue({
      user: { email: "test@example.com" },
      expires: "2099-01-01",
    });

    mockFrom.mockReturnValue({
      upsert: vi.fn().mockRejectedValue(new Error("Database error")),
    });

    const request = new NextRequest("http://localhost:3000/api/settings", {
      body: JSON.stringify({ search_defaults: { similarity_threshold: 0.3 } }),
      method: "PUT",
    });

    const response = await PUT(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBeDefined();
  });
});
