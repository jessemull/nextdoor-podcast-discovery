import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { PUT } from "@/app/api/admin/jobs/[id]/cancel/route";

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
const mockUpdate = vi.fn() as any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockEq = vi.fn() as any;
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

describe("PUT /api/admin/jobs/:id/cancel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return 401 when not authenticated", async () => {
    vi.mocked(getServerSession).mockResolvedValue(null);

    const request = new NextRequest("http://localhost:3000/api/admin/jobs/job-1/cancel", {
      method: "PUT",
    });
    const response = await PUT(request, { params: { id: "job-1" } });
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe("Unauthorized");
  });

  it("should return 400 when job ID is missing", async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { email: "test@example.com" },
    } as never);

    const request = new NextRequest("http://localhost:3000/api/admin/jobs//cancel", {
      method: "PUT",
    });
    const response = await PUT(request, { params: { id: "" } });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe("Job ID is required");
  });

  it("should return 400 when job ID is not a valid UUID", async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { email: "test@example.com" },
    } as never);

    const request = new NextRequest("http://localhost:3000/api/admin/jobs/invalid-id/cancel", {
      method: "PUT",
    });
    const response = await PUT(request, { params: { id: "invalid-id" } });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe("Invalid job ID");
  });

  it("should return 404 when job not found", async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { email: "test@example.com" },
    } as never);

    const mockSelect = vi.fn().mockReturnThis();
    const mockEq = vi.fn().mockReturnThis();
    const mockSingle = vi.fn().mockResolvedValue({
      data: null,
      error: { message: "Job not found" },
    });

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
      "http://localhost:3000/api/admin/jobs/123e4567-e89b-12d3-a456-426614174000/cancel",
      {
        method: "PUT",
      }
    );
    const response = await PUT(request, {
      params: { id: "123e4567-e89b-12d3-a456-426614174000" },
    });
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toBe("Not found");
  });

  it("should return 400 when trying to cancel a completed job", async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { email: "test@example.com" },
    } as never);

    const mockJob = {
      id: "123e4567-e89b-12d3-a456-426614174000",
      status: "completed",
      type: "recompute_final_scores",
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
      "http://localhost:3000/api/admin/jobs/123e4567-e89b-12d3-a456-426614174000/cancel",
      {
        method: "PUT",
      }
    );
    const response = await PUT(request, {
      params: { id: "123e4567-e89b-12d3-a456-426614174000" },
    });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe("Invalid job status");
    expect(data.details).toContain("Cannot cancel job with status");
  });

  it("should cancel a pending job successfully", async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { email: "test@example.com" },
    } as never);

    const mockJob = {
      id: "123e4567-e89b-12d3-a456-426614174000",
      status: "pending",
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
      "http://localhost:3000/api/admin/jobs/123e4567-e89b-12d3-a456-426614174000/cancel",
      {
        method: "PUT",
      }
    );
    const response = await PUT(request, {
      params: { id: "123e4567-e89b-12d3-a456-426614174000" },
    });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.data.success).toBe(true);
    expect(data.data.status).toBe("cancelled");
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        cancelled_at: expect.any(String),
        cancelled_by: "test@example.com",
        status: "cancelled",
      })
    );
  });

  it("should cancel a running job successfully", async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { email: "test@example.com" },
    } as never);

    const mockJob = {
      id: "123e4567-e89b-12d3-a456-426614174000",
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
      "http://localhost:3000/api/admin/jobs/123e4567-e89b-12d3-a456-426614174000/cancel",
      {
        method: "PUT",
      }
    );
    const response = await PUT(request, {
      params: { id: "123e4567-e89b-12d3-a456-426614174000" },
    });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.data.success).toBe(true);
  });
});
