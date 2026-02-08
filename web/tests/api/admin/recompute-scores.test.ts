import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { POST } from "@/app/api/admin/recompute-scores/route";

// Mock next-auth
vi.mock("next-auth", () => ({
  getServerSession: vi.fn(),
}));

// Mock auth options
vi.mock("@/lib/auth", () => ({
  authOptions: {},
}));

// Mock Supabase
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockFrom = vi.fn() as any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockInsert = vi.fn() as any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockSelect = vi.fn() as any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockSingle = vi.fn() as any;

const mockSupabase = {
  from: mockFrom,
};

vi.mock("@/lib/supabase.server", () => ({
  getSupabaseAdmin: () => mockSupabase,
}));

import { getServerSession } from "next-auth";

describe("POST /api/admin/recompute-scores", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return 401 when not authenticated", async () => {
    vi.mocked(getServerSession).mockResolvedValue(null);

    const request = new NextRequest("http://localhost:3000/api/admin/recompute-scores", {
      method: "POST",
      body: JSON.stringify({
        ranking_weights: {
          absurdity: 2.0,
          drama: 1.5,
          discussion_spark: 1.0,
          emotional_intensity: 1.2,
          news_value: 1.0,
        },
      }),
    });
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe("Unauthorized");
  });

  it("should return 400 when ranking_weights is missing", async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { email: "test@example.com" },
    } as never);

    const request = new NextRequest("http://localhost:3000/api/admin/recompute-scores", {
      method: "POST",
      body: JSON.stringify({}),
    });
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe("ranking_weights is required");
  });

  it("should return 400 when ranking_weights is not an object", async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { email: "test@example.com" },
    } as never);

    const request = new NextRequest("http://localhost:3000/api/admin/recompute-scores", {
      method: "POST",
      body: JSON.stringify({ ranking_weights: "invalid" }),
    });
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe("ranking_weights must be an object");
  });

  it("should return 400 when weight value is out of bounds", async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { email: "test@example.com" },
    } as never);

    const request = new NextRequest("http://localhost:3000/api/admin/recompute-scores", {
      method: "POST",
      body: JSON.stringify({
        ranking_weights: {
          absurdity: 15.0, // Out of bounds
          drama: 1.5,
          discussion_spark: 1.0,
          emotional_intensity: 1.2,
          news_value: 1.0,
        },
      }),
    });
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain("must be between 0 and 10");
  });

  it("should return 400 when invalid dimension is provided", async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { email: "test@example.com" },
    } as never);

    const request = new NextRequest("http://localhost:3000/api/admin/recompute-scores", {
      method: "POST",
      body: JSON.stringify({
        ranking_weights: {
          invalid_dimension: 2.0,
          absurdity: 2.0,
          drama: 1.5,
          discussion_spark: 1.0,
          emotional_intensity: 1.2,
          news_value: 1.0,
        },
      }),
    });
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain("Invalid weight dimensions");
  });

  it("should return 400 when required dimension is missing", async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { email: "test@example.com" },
    } as never);

    const request = new NextRequest("http://localhost:3000/api/admin/recompute-scores", {
      method: "POST",
      body: JSON.stringify({
        ranking_weights: {
          absurdity: 2.0,
          drama: 1.5,
          // Missing discussion_spark, emotional_intensity, news_value
        },
      }),
    });
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain("Missing required weight dimensions");
  });

  it("should create weight config and job when valid", async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { email: "test@example.com" },
    } as never);

    const mockWeightConfig = {
      id: "config-1",
      name: "Test Config",
      weights: {
        absurdity: 2.0,
        drama: 1.5,
        discussion_spark: 1.0,
        emotional_intensity: 1.2,
        news_value: 1.0,
      },
    };

    const mockJob = {
      id: "job-1",
      status: "pending",
      type: "recompute_final_scores",
    };

    // Mock weight config insert
    const weightConfigInsert = vi.fn().mockReturnThis();
    const weightConfigSelect = vi.fn().mockReturnThis();
    const weightConfigSingle = vi.fn().mockResolvedValue({
      data: mockWeightConfig,
      error: null,
    });

    weightConfigInsert.mockReturnValue({
      select: weightConfigSelect,
    });
    weightConfigSelect.mockReturnValue({
      single: weightConfigSingle,
    });

    // Mock job insert
    const jobInsert = vi.fn().mockReturnThis();
    const jobSelect = vi.fn().mockReturnThis();
    const jobSingle = vi.fn().mockResolvedValue({
      data: mockJob,
      error: null,
    });

    jobInsert.mockReturnValue({
      select: jobSelect,
    });
    jobSelect.mockReturnValue({
      single: jobSingle,
    });

    mockFrom.mockImplementation((table: string) => {
      if (table === "weight_configs") {
        return { insert: weightConfigInsert };
      }
      if (table === "background_jobs") {
        return { insert: jobInsert };
      }
      return {};
    });

    const request = new NextRequest("http://localhost:3000/api/admin/recompute-scores", {
      method: "POST",
      body: JSON.stringify({
        ranking_weights: {
          absurdity: 2.0,
          drama: 1.5,
          discussion_spark: 1.0,
          emotional_intensity: 1.2,
          news_value: 1.0,
        },
      }),
    });
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.data.job_id).toBe("job-1");
    expect(data.data.weight_config_id).toBe("config-1");
  });
});
