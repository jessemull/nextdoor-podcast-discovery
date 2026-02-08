import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { GET } from "@/app/api/admin/jobs/route";
import type { MockSupabaseClient, MockSupabaseQueryBuilder } from "@/tests/mocks/types";

// Mock next-auth
vi.mock("next-auth", () => ({
  getServerSession: vi.fn(),
}));

// Mock auth options
vi.mock("@/lib/auth", () => ({
  authOptions: {},
}));

// Mock Supabase
const mockFrom = vi.fn<[string], MockSupabaseQueryBuilder>();
const mockSupabase: MockSupabaseClient = {
  from: mockFrom,
};

vi.mock("@/lib/supabase.server", () => ({
  getSupabaseAdmin: () => mockSupabase,
}));

import { getServerSession } from "next-auth";

describe("GET /api/admin/jobs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return 401 when not authenticated", async () => {
    vi.mocked(getServerSession).mockResolvedValue(null);

    const request = new NextRequest("http://localhost:3000/api/admin/jobs");
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe("Unauthorized");
  });

  it("should return jobs when authenticated", async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { email: "test@example.com" },
    } as never);

    const mockJobs = [
      {
        id: "job-1",
        type: "recompute_final_scores",
        status: "completed",
        created_at: "2024-01-01T00:00:00Z",
      },
    ];

    const mockSelect = vi.fn().mockReturnThis();
    const mockOrder = vi.fn().mockReturnThis();
    const mockLimit = vi.fn().mockResolvedValue({ data: mockJobs, error: null });

    mockSelect.mockReturnValue({
      order: mockOrder,
    });
    mockOrder.mockReturnValue({
      limit: mockLimit,
    });
    mockFrom.mockReturnValue({
      select: mockSelect,
    });

    const request = new NextRequest("http://localhost:3000/api/admin/jobs");
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.data).toEqual(mockJobs);
  });

  it("should filter by type when provided", async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { email: "test@example.com" },
    } as never);

    const mockSelect = vi.fn().mockReturnThis();
    const mockOrder = vi.fn().mockReturnThis();
    const mockEq = vi.fn().mockResolvedValue({ data: [], error: null });
    const mockLimit = vi.fn().mockReturnValue({
      eq: mockEq,
    });

    mockSelect.mockReturnValue({
      order: mockOrder,
    });
    mockOrder.mockReturnValue({
      limit: mockLimit,
    });
    mockFrom.mockReturnValue({
      select: mockSelect,
    });

    const request = new NextRequest(
      "http://localhost:3000/api/admin/jobs?type=recompute_final_scores"
    );
    const response = await GET(request);

    expect(response.status).toBe(200);
    expect(mockEq).toHaveBeenCalledWith("type", "recompute_final_scores");
  });

  it("should return specific job when id is provided", async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { email: "test@example.com" },
    } as never);

    const mockJob = {
      id: "job-1",
      type: "recompute_final_scores",
      status: "completed",
    };

    const mockSelect = vi.fn().mockReturnThis();
    const mockEq = vi.fn().mockReturnThis();
    const mockSingle = vi.fn().mockResolvedValue({ data: mockJob, error: null });

    mockSelect.mockReturnValue({
      eq: mockEq,
    });
    mockEq.mockReturnValue({
      single: mockSingle,
    });
    mockFrom.mockReturnValue({
      select: mockSelect,
    });

    const request = new NextRequest(
      "http://localhost:3000/api/admin/jobs?id=job-1"
    );
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.data).toEqual(mockJob);
  });
});
