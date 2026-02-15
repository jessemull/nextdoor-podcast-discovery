import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { GET } from "@/app/api/admin/jobs/stats/route";
import type { MockSupabaseClient, MockSupabaseQueryBuilder } from "@/tests/mocks/types";

// Mock Auth0
vi.mock("@/lib/auth0", () => ({
  auth0: { getSession: vi.fn() },
}));

// Mock Supabase
const mockFrom = vi.fn<[string], MockSupabaseQueryBuilder>();
const mockSupabase: MockSupabaseClient = {
  from: mockFrom,
};

vi.mock("@/lib/supabase.server", () => ({
  getSupabaseAdmin: () => mockSupabase,
}));

import { auth0 } from "@/lib/auth0";

describe("GET /api/admin/jobs/stats", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return 401 when not authenticated", async () => {
    vi.mocked(auth0.getSession).mockResolvedValue(null);

    const request = new NextRequest("http://localhost:3000/api/admin/jobs/stats");
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe("Unauthorized");
  });

  it("should return empty stats when no jobs exist", async () => {
    vi.mocked(auth0.getSession).mockResolvedValue({
      user: { email: "test@example.com" },
    } as never);

    const mockSelect = vi.fn().mockReturnThis();
    const mockOrder = vi.fn().mockResolvedValue({ data: [], error: null });

    mockSelect.mockReturnValue({
      order: mockOrder,
    });
    mockFrom.mockReturnValue({
      select: mockSelect,
    });

    const request = new NextRequest("http://localhost:3000/api/admin/jobs/stats");
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.data.total_jobs).toBe(0);
    expect(data.data.by_status).toEqual({});
    expect(data.data.by_type).toEqual({});
    expect(data.data.average_duration_seconds).toBe(0);
    expect(data.data.success_rate).toBe(0);
  });

  it("should calculate statistics correctly", async () => {
    vi.mocked(auth0.getSession).mockResolvedValue({
      user: { email: "test@example.com" },
    } as never);

    const mockJobs = [
      {
        id: "job-1",
        type: "recompute_final_scores",
        status: "completed",
        started_at: "2024-01-01T00:00:00Z",
        completed_at: "2024-01-01T00:00:45Z",
        created_at: "2024-01-01T00:00:00Z",
      },
      {
        id: "job-2",
        type: "recompute_final_scores",
        status: "completed",
        started_at: "2024-01-01T00:01:00Z",
        completed_at: "2024-01-01T00:01:30Z",
        created_at: "2024-01-01T00:01:00Z",
      },
      {
        id: "job-3",
        type: "recompute_final_scores",
        status: "error",
        created_at: "2024-01-01T00:02:00Z",
      },
      {
        id: "job-4",
        type: "recompute_final_scores",
        status: "pending",
        created_at: "2024-01-01T00:03:00Z",
      },
    ];

    const mockSelect = vi.fn().mockReturnThis();
    const mockOrder = vi.fn().mockResolvedValue({ data: mockJobs, error: null });

    mockSelect.mockReturnValue({
      order: mockOrder,
    });
    mockFrom.mockReturnValue({
      select: mockSelect,
    });

    const request = new NextRequest("http://localhost:3000/api/admin/jobs/stats");
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.data.total_jobs).toBe(4);
    expect(data.data.by_status.completed).toBe(2);
    expect(data.data.by_status.error).toBe(1);
    expect(data.data.by_status.pending).toBe(1);
    expect(data.data.by_type["recompute_final_scores"]).toBe(4);
    // Average duration: (45 + 30) / 2 = 37.5 seconds, rounded = 38
    expect(data.data.average_duration_seconds).toBe(38);
    // Success rate: 2 / (2 + 1) * 100 = 66.67, rounded to 2 decimals = 66.67
    expect(data.data.success_rate).toBe(66.67);
  });

  it("should handle jobs with missing timestamps", async () => {
    vi.mocked(auth0.getSession).mockResolvedValue({
      user: { email: "test@example.com" },
    } as never);

    const mockJobs = [
      {
        id: "job-1",
        type: "recompute_final_scores",
        status: "completed",
        started_at: "2024-01-01T00:00:00Z",
        completed_at: null,
        created_at: "2024-01-01T00:00:00Z",
      },
      {
        id: "job-2",
        type: "recompute_final_scores",
        status: "completed",
        started_at: null,
        completed_at: "2024-01-01T00:01:00Z",
        created_at: "2024-01-01T00:01:00Z",
      },
    ];

    const mockSelect = vi.fn().mockReturnThis();
    const mockOrder = vi.fn().mockResolvedValue({ data: mockJobs, error: null });

    mockSelect.mockReturnValue({
      order: mockOrder,
    });
    mockFrom.mockReturnValue({
      select: mockSelect,
    });

    const request = new NextRequest("http://localhost:3000/api/admin/jobs/stats");
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    // Jobs with missing timestamps should not be included in average duration
    expect(data.data.average_duration_seconds).toBe(0);
  });
});
