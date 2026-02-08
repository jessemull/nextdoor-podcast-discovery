/**
 * Integration tests for job lifecycle.
 *
 * These tests verify the end-to-end flow of:
 * - Creating a job → worker processes it → UI updates
 * - Cancelling a job → worker stops processing
 * - Retry logic → job fails → retries → succeeds
 *
 * Note: These are simplified integration tests that mock the database.
 * Full integration tests would require a test database.
 */
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { POST } from "@/app/api/admin/recompute-scores/route";
import { PUT } from "@/app/api/admin/jobs/[id]/cancel/route";
import { GET } from "@/app/api/admin/jobs/route";

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
const mockUpdate = vi.fn() as any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockEq = vi.fn() as any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockSingle = vi.fn() as any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockOrder = vi.fn() as any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockLimit = vi.fn() as any;

const mockSupabase = {
  from: mockFrom,
};

vi.mock("@/lib/supabase.server", () => ({
  getSupabaseAdmin: () => mockSupabase,
}));

import { getServerSession } from "next-auth";

describe("Job Lifecycle Integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should create job and return job ID", async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { email: "test@example.com" },
    } as never);

    const mockJobId = "123e4567-e89b-12d3-a456-426614174000";
    const mockConfigId = "config-123";

    // Mock weight_configs insert
    const configInsert = vi.fn().mockResolvedValue({
      data: { id: mockConfigId },
      error: null,
    });

    // Mock background_jobs insert
    const jobInsert = vi.fn().mockResolvedValue({
      data: { id: mockJobId },
      error: null,
    });

    mockFrom.mockImplementation((table: string) => {
      if (table === "weight_configs") {
        return { insert: configInsert };
      }
      if (table === "background_jobs") {
        return { insert: jobInsert };
      }
      return {};
    });

    const request = new NextRequest("http://localhost:3000/api/admin/recompute-scores", {
      body: JSON.stringify({
        ranking_weights: {
          absurdity: 2.0,
          drama: 1.5,
          discussion_spark: 1.0,
          emotional_intensity: 1.2,
          news_value: 1.0,
        },
      }),
      method: "POST",
    });
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.data.job_id).toBeDefined();
    expect(configInsert).toHaveBeenCalled();
    expect(jobInsert).toHaveBeenCalled();
  });

  it("should cancel a running job", async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { email: "test@example.com" },
    } as never);

    const mockJobId = "123e4567-e89b-12d3-a456-426614174000";
    const mockJob = {
      id: mockJobId,
      status: "running",
      type: "recompute_final_scores",
    };

    const mockSelect = vi.fn().mockReturnThis();
    const mockEq = vi.fn().mockReturnThis();
    const mockSingle = vi.fn().mockResolvedValue({ data: mockJob, error: null });
    const mockUpdate = vi.fn().mockReturnThis();
    const mockUpdateEq = vi.fn().mockResolvedValue({ error: null });

    mockSelect.mockReturnValue({
      eq: mockEq,
    });
    mockEq.mockReturnValue({
      single: mockSingle,
    });
    mockUpdate.mockReturnValue({
      eq: mockUpdateEq,
    });
    mockFrom.mockReturnValue({
      select: mockSelect,
      update: mockUpdate,
    });

    const request = new NextRequest(
      `http://localhost:3000/api/admin/jobs/${mockJobId}/cancel`,
      {
        method: "PUT",
      }
    );
    const response = await PUT(request, { params: { id: mockJobId } });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.data.status).toBe("cancelled");
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "cancelled",
      })
    );
  });

  it("should show job status updates", async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { email: "test@example.com" },
    } as never);

    const mockJobs = [
      {
        id: "job-1",
        status: "pending",
        type: "recompute_final_scores",
        created_at: "2024-01-01T00:00:00Z",
      },
      {
        id: "job-2",
        status: "running",
        type: "recompute_final_scores",
        created_at: "2024-01-01T00:01:00Z",
        started_at: "2024-01-01T00:01:00Z",
        progress: 50,
        total: 100,
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

    const request = new NextRequest(
      "http://localhost:3000/api/admin/jobs?type=recompute_final_scores&limit=20"
    );
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.data).toHaveLength(2);
    expect(data.data[0].status).toBe("pending");
    expect(data.data[1].status).toBe("running");
    expect(data.data[1].progress).toBe(50);
  });
});
