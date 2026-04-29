import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { POST as postBackfillDimension } from "@/app/api/admin/backfill-dimension/route";
import { POST as postInvalidateActiveConfig } from "@/app/api/admin/invalidate-active-config/route";
import { POST as postJobRetry } from "@/app/api/admin/jobs/[id]/retry/route";
import { DELETE as deleteJobById } from "@/app/api/admin/jobs/[id]/route";
import { POST as postPermalinkQueue } from "@/app/api/admin/permalink-queue/route";
import { GET as getScraperRuns } from "@/app/api/admin/scraper-runs/route";
import { POST as postTriggerScrape } from "@/app/api/admin/trigger-scrape/route";
import { POST as postAddScoringFewShotPosts } from "@/app/api/settings/scoring-few-shot/add-posts/route";

vi.mock("@/lib/supabase-server-auth", () => ({
  getSession: vi.fn(),
}));

const mockFrom = vi.fn() as any;

vi.mock("@/lib/supabase.server", () => ({
  getSupabaseAdmin: () => ({ from: mockFrom }),
}));

vi.mock("@/lib/log.server", () => ({
  logError: vi.fn(),
}));

vi.mock("@/lib/active-config-cache.server", () => ({
  invalidateActiveConfigCache: vi.fn().mockResolvedValue(undefined),
}));

import { invalidateActiveConfigCache } from "@/lib/active-config-cache.server";
import { getSession } from "@/lib/supabase-server-auth";

const JOB_UUID = "550e8400-e29b-41d4-a716-446655440099";
const POST_UUID = "660e8400-e29b-41d4-a716-446655440001";

const authUser = {
  user: { email: "admin@example.com", id: "admin-id" },
};

function paramsId(id: string) {
  return { params: Promise.resolve({ id }) };
}

describe("admin ops routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getSession).mockResolvedValue(authUser as never);
  });

  describe("DELETE /api/admin/jobs/[id]", () => {
    it("should return 401 when not authenticated", async () => {
      vi.mocked(getSession).mockResolvedValue(null);

      const request = new NextRequest("http://localhost:3000/api/admin/jobs/x");
      const response = await deleteJobById(request, paramsId(JOB_UUID));
      expect(response.status).toBe(401);
    });

    it("should return 400 for invalid UUID", async () => {
      const request = new NextRequest("http://localhost:3000/api/admin/jobs/bad");
      const response = await deleteJobById(request, paramsId("not-a-uuid"));
      expect(response.status).toBe(400);
    });

    it("should return 404 when job missing", async () => {
      const single = vi.fn().mockResolvedValue({ data: null, error: { message: "none" } });
      const eq = vi.fn().mockReturnValue({ single });
      const select = vi.fn().mockReturnValue({ eq });
      mockFrom.mockReturnValue({ select });

      const request = new NextRequest("http://localhost:3000/api/admin/jobs/1");
      const response = await deleteJobById(request, paramsId(JOB_UUID));
      expect(response.status).toBe(404);
    });

    it("should delete pending job", async () => {
      const deleteEq = vi.fn().mockResolvedValue({ error: null });
      const deleteFn = vi.fn().mockReturnValue({ eq: deleteEq });
      const single = vi.fn().mockResolvedValue({
        data: { id: JOB_UUID, status: "pending" },
        error: null,
      });
      const eq = vi.fn().mockReturnValue({ single });
      const select = vi.fn().mockReturnValue({ eq });
      mockFrom.mockReturnValue({
        delete: deleteFn,
        select,
      });

      const request = new NextRequest("http://localhost:3000/api/admin/jobs/1");
      const response = await deleteJobById(request, paramsId(JOB_UUID));
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.data.deleted).toBe(true);
    });
  });

  describe("POST /api/admin/jobs/[id]/retry", () => {
    it("should return 401 when not authenticated", async () => {
      vi.mocked(getSession).mockResolvedValue(null);

      const request = new NextRequest("http://localhost:3000/api/admin/jobs/x/retry", {
        method: "POST",
      });
      const response = await postJobRetry(request, paramsId(JOB_UUID));
      expect(response.status).toBe(401);
    });

    it("should return 400 when job is not error or cancelled", async () => {
      const single = vi.fn().mockResolvedValue({
        data: {
          id: JOB_UUID,
          params: {},
          status: "pending",
          type: "run_scraper",
        },
        error: null,
      });
      const eq = vi.fn().mockReturnValue({ single });
      const select = vi.fn().mockReturnValue({ eq });
      mockFrom.mockReturnValue({ select });

      const request = new NextRequest("http://localhost:3000/api/admin/jobs/x/retry", {
        method: "POST",
      });
      const response = await postJobRetry(request, paramsId(JOB_UUID));
      expect(response.status).toBe(400);
    });

    it("should create retry job for error status", async () => {
      const newJob = { id: "770e8400-e29b-41d4-a716-446655440088", status: "pending" };
      const insertSingle = vi.fn().mockResolvedValue({ data: newJob, error: null });
      const insertSelect = vi.fn().mockReturnValue({ single: insertSingle });
      const insert = vi.fn().mockReturnValue({ select: insertSelect });

      const jobSingle = vi.fn().mockResolvedValue({
        data: {
          id: JOB_UUID,
          params: { a: 1 },
          status: "error",
          type: "run_scraper",
        },
        error: null,
      });
      const jobEq = vi.fn().mockReturnValue({ single: jobSingle });
      const select = vi.fn().mockReturnValue({ eq: jobEq });

      mockFrom.mockReturnValue({
        insert,
        select,
      });

      const request = new NextRequest("http://localhost:3000/api/admin/jobs/x/retry", {
        method: "POST",
      });
      const response = await postJobRetry(request, paramsId(JOB_UUID));
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.data.id).toBe(newJob.id);
    });
  });

  describe("POST /api/admin/trigger-scrape", () => {
    it("should return 401 when not authenticated", async () => {
      vi.mocked(getSession).mockResolvedValue(null);

      const request = new NextRequest("http://localhost:3000/api/admin/trigger-scrape", {
        body: JSON.stringify({}),
        method: "POST",
      });
      const response = await postTriggerScrape(request);
      expect(response.status).toBe(401);
    });

    it("should enqueue run_scraper job", async () => {
      const jobRow = { id: JOB_UUID, status: "pending" };
      const single = vi.fn().mockResolvedValue({ data: jobRow, error: null });
      const select = vi.fn().mockReturnValue({ single });
      const insert = vi.fn().mockReturnValue({ select });
      mockFrom.mockReturnValue({ insert });

      const request = new NextRequest("http://localhost:3000/api/admin/trigger-scrape", {
        body: JSON.stringify({ feed_type: "trending" }),
        method: "POST",
      });
      const response = await postTriggerScrape(request);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.data.job_id).toBe(JOB_UUID);
      expect(body.data.feed_type).toBe("trending");
    });
  });

  describe("GET /api/admin/scraper-runs", () => {
    it("should return 401 when not authenticated", async () => {
      vi.mocked(getSession).mockResolvedValue(null);

      const request = new NextRequest("http://localhost:3000/api/admin/scraper-runs");
      const response = await getScraperRuns(request);
      expect(response.status).toBe(401);
    });

    it("should return runs with limit query", async () => {
      const runs = [
        {
          error_message: null,
          feed_type: "trending",
          id: "r1",
          run_at: "2025-01-01",
          scoring_attempted_count: 10,
          scoring_error_count: 0,
          scoring_saved_count: 10,
          scoring_skipped_count: 0,
          status: "ok",
        },
      ];
      const jobsSelect = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          in: vi.fn().mockResolvedValue({ data: [], error: null }),
        }),
      });
      const order = vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue({ data: runs, error: null }),
      });
      const runsSelect = vi.fn().mockReturnValue({ order });

      mockFrom.mockImplementation((table: string) => {
        if (table === "background_jobs") {
          return { select: jobsSelect };
        }
        if (table === "scraper_runs") {
          return { select: runsSelect };
        }
        return {};
      });

      const request = new NextRequest(
        "http://localhost:3000/api/admin/scraper-runs?limit=5"
      );
      const response = await getScraperRuns(request);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.data).toEqual(runs);
      expect(Array.isArray(body.queued_retry_run_ids)).toBe(true);
    });
  });

  describe("POST /api/admin/permalink-queue", () => {
    it("should return 400 for invalid body", async () => {
      const request = new NextRequest("http://localhost:3000/api/admin/permalink-queue", {
        body: JSON.stringify({ url: "https://example.com" }),
        method: "POST",
      });
      const response = await postPermalinkQueue(request);
      expect(response.status).toBe(400);
    });

    it("should create fetch_permalink job with url only", async () => {
      const jobRow = { id: JOB_UUID, status: "pending" };
      const single = vi.fn().mockResolvedValue({ data: jobRow, error: null });
      const select = vi.fn().mockReturnValue({ single });
      const insert = vi.fn().mockReturnValue({ select });
      mockFrom.mockReturnValue({ insert });

      const request = new NextRequest("http://localhost:3000/api/admin/permalink-queue", {
        body: JSON.stringify({
          url: "https://nextdoor.com/p/ABC123_xyz",
        }),
        method: "POST",
      });
      const response = await postPermalinkQueue(request);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.data.job_id).toBe(JOB_UUID);
    });
  });

  describe("POST /api/admin/backfill-dimension", () => {
    it("should return 400 when body invalid", async () => {
      const request = new NextRequest("http://localhost:3000/api/admin/backfill-dimension", {
        body: JSON.stringify({ dimension: "nope" }),
        method: "POST",
      });
      const response = await postBackfillDimension(request);
      expect(response.status).toBe(400);
    });

    it("should create backfill job", async () => {
      const jobRow = { id: JOB_UUID, type: "backfill_dimension" };
      const single = vi.fn().mockResolvedValue({ data: jobRow, error: null });
      const select = vi.fn().mockReturnValue({ single });
      const insert = vi.fn().mockReturnValue({ select });
      mockFrom.mockReturnValue({ insert });

      const request = new NextRequest("http://localhost:3000/api/admin/backfill-dimension", {
        body: JSON.stringify({ dimension: "drama" }),
        method: "POST",
      });
      const response = await postBackfillDimension(request);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.data.type).toBe("backfill_dimension");
    });
  });

  describe("POST /api/admin/invalidate-active-config", () => {
    const OLD_SECRET = process.env.INTERNAL_API_SECRET;

    afterEach(() => {
      process.env.INTERNAL_API_SECRET = OLD_SECRET;
    });

    it("should return 401 without matching secret", async () => {
      process.env.INTERNAL_API_SECRET = "expected";

      const request = new NextRequest("http://localhost:3000/api/admin/invalidate-active-config", {
        headers: { "x-internal-secret": "wrong" },
        method: "POST",
      });
      const response = await postInvalidateActiveConfig(request);
      expect(response.status).toBe(401);
    });

    it("should invalidate cache when secret matches", async () => {
      process.env.INTERNAL_API_SECRET = "expected";

      const request = new NextRequest("http://localhost:3000/api/admin/invalidate-active-config", {
        headers: { "x-internal-secret": "expected" },
        method: "POST",
      });
      const response = await postInvalidateActiveConfig(request);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.ok).toBe(true);
      expect(vi.mocked(invalidateActiveConfigCache)).toHaveBeenCalled();
    });
  });

  describe("POST /api/settings/scoring-few-shot/add-posts", () => {
    it("should return 400 for invalid JSON", async () => {
      const request = new NextRequest(
        "http://localhost:3000/api/settings/scoring-few-shot/add-posts",
        {
          body: "not-json",
          method: "POST",
        }
      );
      const response = await postAddScoringFewShotPosts(request);
      expect(response.status).toBe(400);
    });

    it("should return 200 with zeros when posts not found", async () => {
      const settingsMaybe = vi.fn().mockResolvedValue({ data: null, error: null });
      const settingsSelect = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({ maybeSingle: settingsMaybe }),
      });

      const postsIn = vi.fn().mockResolvedValue({ data: [], error: null });
      const postsSelect = vi.fn().mockReturnValue({ in: postsIn });

      const llmIn = vi.fn().mockResolvedValue({ data: [], error: null });
      const llmSelect = vi.fn().mockReturnValue({ in: llmIn });

      mockFrom.mockImplementation((table: string) => {
        if (table === "settings") {
          return { select: settingsSelect };
        }
        if (table === "posts") {
          return { select: postsSelect };
        }
        if (table === "llm_scores") {
          return { select: llmSelect };
        }
        return {};
      });

      const request = new NextRequest(
        "http://localhost:3000/api/settings/scoring-few-shot/add-posts",
        {
          body: JSON.stringify({ post_ids: [POST_UUID] }),
          method: "POST",
        }
      );
      const response = await postAddScoringFewShotPosts(request);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.data.added).toBe(0);
      expect(body.data.skipped_invalid_or_missing_post).toBeGreaterThan(0);
    });
  });
});
