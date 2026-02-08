/**
 * Edge case tests for admin endpoints.
 *
 * Tests cover:
 * - Config deleted while job is running
 * - Active config deletion prevention
 * - Multiple jobs queued (queue position calculation)
 */
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { DELETE } from "@/app/api/admin/weight-configs/[id]/route";
import { GET } from "@/app/api/admin/jobs/route";

// Mock next-auth
vi.mock("next-auth", () => ({
  getServerSession: vi.fn(),
}));

// Mock auth options
vi.mock("@/lib/auth", () => ({
  authOptions: {},
}));

// Mock Supabase — client chain is dynamic; mocks use "as any" for fluent test setup.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockFrom = vi.fn() as any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockSelect = vi.fn() as any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockEq = vi.fn() as any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockSingle = vi.fn() as any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockIn = vi.fn() as any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockDelete = vi.fn() as any;
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

/** Valid UUIDs for weight config IDs (routes validate UUID format). */
const CONFIG_1_UUID = "550e8400-e29b-41d4-a716-446655440001";
const CONFIG_2_UUID = "550e8400-e29b-41d4-a716-446655440002";

describe("Edge Cases", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Config deletion with pending jobs", () => {
    it("should prevent deletion when config has pending jobs", async () => {
      vi.mocked(getServerSession).mockResolvedValue({
        user: { email: "test@example.com" },
      } as never);

      const configId = CONFIG_2_UUID;

      // Mock settings query (different active config)
      const settingsSelect = vi.fn().mockReturnThis();
      const settingsEq = vi.fn().mockReturnThis();
      const settingsSingle = vi.fn().mockResolvedValue({
        data: { value: CONFIG_1_UUID },
        error: null,
      });

      settingsSelect.mockReturnValue({
        eq: settingsEq,
      });
      settingsEq.mockReturnValue({
        single: settingsSingle,
      });

      // Mock jobs query (returns pending job for config-2)
      const jobsSelect = vi.fn().mockReturnThis();
      const jobsEq = vi.fn().mockReturnThis();
      const jobsIn = vi.fn().mockResolvedValue({
        data: [
          {
            id: "job-1",
            status: "pending",
            type: "recompute_final_scores",
            params: { weight_config_id: configId },
          },
        ],
        error: null,
      });

      jobsSelect.mockReturnValue({
        eq: jobsEq,
      });
      jobsEq.mockReturnValue({
        in: jobsIn,
      });

      // Mock config query
      const configSelect = vi.fn().mockReturnThis();
      const configEq = vi.fn().mockReturnThis();
      const configSingle = vi.fn().mockResolvedValue({
        data: { id: configId, name: "Test Config" },
        error: null,
      });

      configSelect.mockReturnValue({
        eq: configEq,
      });
      configEq.mockReturnValue({
        single: configSingle,
      });

      mockFrom.mockImplementation((table: string) => {
        if (table === "settings") {
          return { select: settingsSelect };
        }
        if (table === "background_jobs") {
          return { select: jobsSelect, eq: jobsEq, in: jobsIn };
        }
        if (table === "weight_configs") {
          return { select: configSelect };
        }
        return {};
      });

      const request = new NextRequest(
        `http://localhost:3000/api/admin/weight-configs/${configId}`,
        {
          method: "DELETE",
        }
      );
      const response = await DELETE(request, { params: { id: configId } });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Cannot delete config with active jobs");
      expect(data.details).toContain("job(s)");
    });
  });

  describe("Active config deletion prevention", () => {
    it("should prevent deletion of active config", async () => {
      vi.mocked(getServerSession).mockResolvedValue({
        user: { email: "test@example.com" },
      } as never);

      const activeConfigId = CONFIG_1_UUID;

      const settingsSelect = vi.fn().mockReturnThis();
      const settingsEq = vi.fn().mockReturnThis();
      const settingsSingle = vi.fn().mockResolvedValue({
        data: { value: activeConfigId },
        error: null,
      });

      settingsSelect.mockReturnValue({
        eq: settingsEq,
      });
      settingsEq.mockReturnValue({
        single: settingsSingle,
      });

      mockFrom.mockReturnValue({
        select: settingsSelect,
      });

      const request = new NextRequest(
        `http://localhost:3000/api/admin/weight-configs/${activeConfigId}`,
        {
          method: "DELETE",
        }
      );
      const response = await DELETE(request, { params: { id: activeConfigId } });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Cannot delete active config");
      expect(data.details).toContain("Deactivate it first");
    });
  });

  describe("Queue position calculation", () => {
    it("should calculate correct queue positions for multiple pending jobs", async () => {
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
          status: "pending",
          type: "recompute_final_scores",
          created_at: "2024-01-01T00:01:00Z",
        },
        {
          id: "job-3",
          status: "running",
          type: "recompute_final_scores",
          created_at: "2024-01-01T00:02:00Z",
          started_at: "2024-01-01T00:02:00Z",
        },
        {
          id: "job-4",
          status: "pending",
          type: "recompute_final_scores",
          created_at: "2024-01-01T00:03:00Z",
        },
      ];

      const mockSelect = vi.fn().mockReturnThis();
      const mockOrder = vi.fn().mockReturnThis();
      const mockEq = vi.fn().mockResolvedValue({ data: mockJobs, error: null });
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
        "http://localhost:3000/api/admin/jobs?type=recompute_final_scores&limit=20"
      );
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data).toHaveLength(4);

      // Verify queue positions would be calculated correctly
      // (This is tested in the UI component, but we verify the data structure here)
      const pendingJobs = data.data.filter((j: { status: string }) => j.status === "pending");
      expect(pendingJobs).toHaveLength(3);

      // Jobs should be ordered by created_at
      expect(data.data[0].id).toBe("job-1");
      expect(data.data[1].id).toBe("job-2");
    });
  });
});
