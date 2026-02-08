import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { GET } from "@/app/api/admin/weight-configs/route";
import { DELETE } from "@/app/api/admin/weight-configs/[id]/route";
import { PUT } from "@/app/api/admin/weight-configs/[id]/activate/route";

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
const mockUpdate = vi.fn() as any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockDelete = vi.fn() as any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockUpsert = vi.fn() as any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockSelect = vi.fn() as any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockEq = vi.fn() as any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockSingle = vi.fn() as any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockOrder = vi.fn() as any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockIn = vi.fn() as any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockNeq = vi.fn() as any;

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

describe("GET /api/admin/weight-configs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return 401 when not authenticated", async () => {
    vi.mocked(getServerSession).mockResolvedValue(null);

    const request = new NextRequest("http://localhost:3000/api/admin/weight-configs");
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe("Unauthorized");
  });

  it("should return weight configs when authenticated", async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { email: "test@example.com" },
    } as never);

    const mockConfigs = [
      {
        id: CONFIG_1_UUID,
        name: "Test Config",
        weights: { absurdity: 2.0, drama: 1.5 },
        is_active: true,
      },
    ];

    const mockActiveConfigResult = {
      data: { value: CONFIG_1_UUID },
      error: null,
    };

    const mockScoresData = [
      { weight_config_id: CONFIG_1_UUID },
    ];

    // Mock settings query
    const settingsSelect = vi.fn().mockReturnThis();
    const settingsEq = vi.fn().mockReturnThis();
    const settingsSingle = vi.fn().mockResolvedValue(mockActiveConfigResult);

    settingsSelect.mockReturnValue({
      eq: settingsEq,
    });
    settingsEq.mockReturnValue({
      single: settingsSingle,
    });

    // Mock configs query
    const configsSelect = vi.fn().mockReturnThis();
    const configsOrder = vi.fn().mockResolvedValue({
      data: mockConfigs,
      error: null,
    });

    configsSelect.mockReturnValue({
      order: configsOrder,
    });

    // Mock post_scores query
    const scoresSelect = vi.fn().mockReturnThis();
    const scoresIn = vi.fn().mockResolvedValue({
      data: mockScoresData,
      error: null,
    });

    scoresSelect.mockReturnValue({
      in: scoresIn,
    });

    mockFrom.mockImplementation((table: string) => {
      if (table === "settings") {
        return { select: settingsSelect };
      }
      if (table === "weight_configs") {
        return { select: configsSelect };
      }
      if (table === "post_scores") {
        return { select: scoresSelect };
      }
      return {};
    });

    const request = new NextRequest("http://localhost:3000/api/admin/weight-configs");
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.data).toBeDefined();
    expect(data.active_config_id).toBe(CONFIG_1_UUID);
  });
});

describe("DELETE /api/admin/weight-configs/:id", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return 401 when not authenticated", async () => {
    vi.mocked(getServerSession).mockResolvedValue(null);

    const request = new NextRequest(`http://localhost:3000/api/admin/weight-configs/${CONFIG_1_UUID}`, {
      method: "DELETE",
    });
    const response = await DELETE(request, { params: { id: CONFIG_1_UUID } });
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe("Unauthorized");
  });

  it("should return 400 when trying to delete active config", async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { email: "test@example.com" },
    } as never);

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

    mockFrom.mockReturnValue({
      select: settingsSelect,
    });

    const request = new NextRequest(`http://localhost:3000/api/admin/weight-configs/${CONFIG_1_UUID}`, {
      method: "DELETE",
    });
    const response = await DELETE(request, { params: { id: CONFIG_1_UUID } });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe("Cannot delete active config");
  });

  it("should delete config when not active", async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { email: "test@example.com" },
    } as never);

    const mockConfig = {
      id: CONFIG_2_UUID,
      name: "Test Config",
    };

    // Mock settings query (returns different active config)
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

    // Mock config query
    const configSelect = vi.fn().mockReturnThis();
    const configEq = vi.fn().mockReturnThis();
    const configSingle = vi.fn().mockResolvedValue({
      data: mockConfig,
      error: null,
    });

    configSelect.mockReturnValue({
      eq: configEq,
    });
    configEq.mockReturnValue({
      single: configSingle,
    });

    // Mock background_jobs (no pending jobs for this config)
    const jobsSelect = vi.fn().mockReturnThis();
    const jobsEq = vi.fn().mockReturnThis();
    const jobsIn = vi.fn().mockResolvedValue({
      data: [],
      error: null,
    });
    jobsSelect.mockReturnValue({ eq: jobsEq });
    jobsEq.mockReturnValue({ in: jobsIn });

    // Mock delete
    const deleteEq = vi.fn().mockResolvedValue({
      error: null,
    });

    mockFrom.mockImplementation((table: string) => {
      if (table === "settings") {
        return { select: settingsSelect };
      }
      if (table === "background_jobs") {
        return { select: jobsSelect };
      }
      if (table === "weight_configs") {
        return {
          select: configSelect,
          delete: () => ({ eq: deleteEq }),
        };
      }
      return {};
    });

    const request = new NextRequest(`http://localhost:3000/api/admin/weight-configs/${CONFIG_2_UUID}`, {
      method: "DELETE",
    });
    const response = await DELETE(request, { params: { id: CONFIG_2_UUID } });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.data.success).toBe(true);
  });

  it("should return 400 when trying to delete config with pending jobs", async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { email: "test@example.com" },
    } as never);

    // Mock settings query (returns different active config)
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

    // Mock jobs query
    const jobsSelect = vi.fn().mockReturnThis();
    const jobsEq = vi.fn().mockReturnThis();
    const jobsIn = vi.fn().mockResolvedValue({
      data: [
        {
          id: "job-1",
          status: "pending",
          type: "recompute_final_scores",
          params: { weight_config_id: CONFIG_2_UUID },
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
      data: { id: CONFIG_2_UUID, name: "Test Config" },
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

    const request = new NextRequest(`http://localhost:3000/api/admin/weight-configs/${CONFIG_2_UUID}`, {
      method: "DELETE",
    });
    const response = await DELETE(request, { params: { id: CONFIG_2_UUID } });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe("Cannot delete config with active jobs");
    expect(data.details).toContain("job(s)");
  });
});

describe("PUT /api/admin/weight-configs/:id/activate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return 401 when not authenticated", async () => {
    vi.mocked(getServerSession).mockResolvedValue(null);

    const request = new NextRequest(`http://localhost:3000/api/admin/weight-configs/${CONFIG_1_UUID}/activate`, {
      method: "PUT",
    });
    const response = await PUT(request, { params: { id: CONFIG_1_UUID } });
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe("Unauthorized");
  });

  it("should activate config when authenticated", async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { email: "test@example.com" },
    } as never);

    const mockConfig = {
      id: CONFIG_1_UUID,
      name: "Test Config",
    };

    // Mock config query
    const configSelect = vi.fn().mockReturnThis();
    const configEq = vi.fn().mockReturnThis();
    const configSingle = vi.fn().mockResolvedValue({
      data: mockConfig,
      error: null,
    });

    configSelect.mockReturnValue({
      eq: configEq,
    });
    configEq.mockReturnValue({
      single: configSingle,
    });

    // Mock settings upsert
    const settingsUpsert = vi.fn().mockResolvedValue({
      error: null,
    });

    // Mock weight_configs update
    const configsUpdate = vi.fn().mockReturnThis();
    const configsNeq = vi.fn().mockReturnThis();
    const configsEq = vi.fn().mockResolvedValue({
      error: null,
    });

    configsUpdate.mockReturnValue({
      neq: configsNeq,
      eq: configsEq,
    });
    configsNeq.mockReturnValue({
      eq: configsEq,
    });

    mockFrom.mockImplementation((table: string) => {
      if (table === "weight_configs") {
        return {
          select: configSelect,
          update: configsUpdate,
        };
      }
      if (table === "settings") {
        return { upsert: settingsUpsert };
      }
      return {};
    });

    const request = new NextRequest(`http://localhost:3000/api/admin/weight-configs/${CONFIG_1_UUID}/activate`, {
      method: "PUT",
    });
    const response = await PUT(request, { params: { id: CONFIG_1_UUID } });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.data.success).toBe(true);
    expect(data.data.active_config_id).toBe(CONFIG_1_UUID);
  });
});
