/** @vitest-environment node */

import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { GET as getCategoryById } from "@/app/api/admin/podcast/categories/[id]/route";
import { GET as getCategories, POST as postCategory } from "@/app/api/admin/podcast/categories/route";
import { GET as getEpisodeSignedUrl } from "@/app/api/admin/podcast/episodes/[id]/signed-url/route";
import { GET as getEpisodes } from "@/app/api/admin/podcast/episodes/route";
import { POST as postUpload } from "@/app/api/admin/podcast/upload/route";

vi.mock("@/lib/supabase-server-auth", () => ({
  getSession: vi.fn(),
}));

const mockFrom = vi.fn() as any;
const mockStorageFrom = vi.fn() as any;

vi.mock("@/lib/supabase.server", () => ({
  getSupabaseAdmin: () => ({
    from: mockFrom,
    storage: { from: mockStorageFrom },
  }),
}));

import { getSession } from "@/lib/supabase-server-auth";

const CAT_ID = "550e8400-e29b-41d4-a716-4466554400aa";
const EP_ID = "660e8400-e29b-41d4-a716-4466554400bb";

const authUser = {
  user: { email: "admin@example.com", id: "admin-id" },
};

describe("admin podcast routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getSession).mockResolvedValue(authUser as never);
  });

  describe("GET /api/admin/podcast/categories", () => {
    it("should return 401 when not authenticated", async () => {
      vi.mocked(getSession).mockResolvedValue(null);

      const request = new NextRequest("http://localhost:3000/api/admin/podcast/categories");
      const response = await getCategories(request);
      expect(response.status).toBe(401);
    });

    it("should return all categories when not paginating", async () => {
      const rows = [{ id: CAT_ID, name: "Crime" }];
      const order = vi.fn().mockResolvedValue({ data: rows, error: null });
      const select = vi.fn().mockReturnValue({ order });
      mockFrom.mockReturnValue({ select });

      const request = new NextRequest("http://localhost:3000/api/admin/podcast/categories");
      const response = await getCategories(request);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.data).toEqual(rows);
      expect(body.total).toBe(1);
    });
  });

  describe("POST /api/admin/podcast/categories", () => {
    it("should return 400 when name missing", async () => {
      const request = new NextRequest("http://localhost:3000/api/admin/podcast/categories", {
        body: JSON.stringify({}),
        method: "POST",
      });
      const response = await postCategory(request);
      expect(response.status).toBe(400);
    });

    it("should create category", async () => {
      const created = { description: null, id: CAT_ID, name: "News", slug: "news" };
      const single = vi.fn().mockResolvedValue({ data: created, error: null });
      const select = vi.fn().mockReturnValue({ single });
      const insert = vi.fn().mockReturnValue({ select });
      mockFrom.mockReturnValue({ insert });

      const request = new NextRequest("http://localhost:3000/api/admin/podcast/categories", {
        body: JSON.stringify({ name: "News" }),
        method: "POST",
      });
      const response = await postCategory(request);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.data.slug).toBe("news");
    });
  });

  describe("GET /api/admin/podcast/categories/[id]", () => {
    it("should return 404 when not found", async () => {
      const single = vi.fn().mockResolvedValue({
        data: null,
        error: { code: "PGRST116", message: "not found" },
      });
      const eq = vi.fn().mockReturnValue({ single });
      const select = vi.fn().mockReturnValue({ eq });
      mockFrom.mockReturnValue({ select });

      const request = new NextRequest("http://localhost:3000/api/admin/podcast/categories/x");
      const response = await getCategoryById(request, {
        params: Promise.resolve({ id: CAT_ID }),
      });
      expect(response.status).toBe(404);
    });
  });

  describe("GET /api/admin/podcast/episodes", () => {
    it("should return 401 when not authenticated", async () => {
      vi.mocked(getSession).mockResolvedValue(null);

      const request = new NextRequest("http://localhost:3000/api/admin/podcast/episodes");
      const response = await getEpisodes(request);
      expect(response.status).toBe(401);
    });

    it("should return paginated episodes", async () => {
      const range = vi.fn().mockResolvedValue({
        count: 1,
        data: [{ id: EP_ID, title: "Ep 1" }],
        error: null,
      });
      const order2 = vi.fn().mockReturnValue({ range });
      const order1 = vi.fn().mockReturnValue({ order: order2 });
      const select = vi.fn().mockReturnValue({ order: order1 });
      mockFrom.mockReturnValue({ select });

      const request = new NextRequest(
        "http://localhost:3000/api/admin/podcast/episodes?limit=10&offset=0"
      );
      const response = await getEpisodes(request);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.data).toHaveLength(1);
      expect(body.total).toBe(1);
    });
  });

  describe("GET /api/admin/podcast/episodes/[id]/signed-url", () => {
    it("should return 400 when type invalid", async () => {
      const request = new NextRequest(
        `http://localhost:3000/api/admin/podcast/episodes/${EP_ID}/signed-url?type=video`
      );
      const response = await getEpisodeSignedUrl(request, {
        params: Promise.resolve({ id: EP_ID }),
      });
      expect(response.status).toBe(400);
    });

    it("should return signed URL for audio", async () => {
      const single = vi.fn().mockResolvedValue({
        data: { audio_storage_path: "audio/a.mp3" },
        error: null,
      });
      const eq = vi.fn().mockReturnValue({ single });
      const select = vi.fn().mockReturnValue({ eq });
      mockFrom.mockReturnValue({ select });

      const createSignedUrl = vi.fn().mockResolvedValue({
        data: { signedUrl: "https://example.com/signed" },
        error: null,
      });
      mockStorageFrom.mockReturnValue({ createSignedUrl });

      const request = new NextRequest(
        `http://localhost:3000/api/admin/podcast/episodes/${EP_ID}/signed-url?type=audio`
      );
      const response = await getEpisodeSignedUrl(request, {
        params: Promise.resolve({ id: EP_ID }),
      });
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.url).toContain("https://");
    });
  });

  describe("POST /api/admin/podcast/upload", () => {
    it("should return 400 when file missing", async () => {
      const form = new FormData();
      form.set("type", "audio");

      const request = new NextRequest("http://localhost:3000/api/admin/podcast/upload", {
        body: form,
        method: "POST",
      });
      const response = await postUpload(request);
      expect(response.status).toBe(400);
    });

    it("should return 400 when type invalid", async () => {
      const form = new FormData();
      form.set("file", new File([new Uint8Array([1, 2, 3])], "a.mp3", { type: "audio/mpeg" }));
      form.set("type", "video");

      const request = new NextRequest("http://localhost:3000/api/admin/podcast/upload", {
        body: form,
        method: "POST",
      });
      const response = await postUpload(request);
      expect(response.status).toBe(400);
    });

    it("should upload audio and return path", async () => {
      const upload = vi.fn().mockResolvedValue({
        data: { path: "uploads/x.mp3" },
        error: null,
      });
      const createSignedUrl = vi.fn().mockResolvedValue({
        data: { signedUrl: "https://preview.example/p" },
        error: null,
      });
      mockStorageFrom.mockReturnValue({ createSignedUrl, upload });

      const form = new FormData();
      form.set("file", new File([new Uint8Array([1, 2, 3])], "a.mp3", { type: "audio/mpeg" }));
      form.set("type", "audio");

      const request = new NextRequest("http://localhost:3000/api/admin/podcast/upload", {
        body: form,
        method: "POST",
      });
      const response = await postUpload(request);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.data.path).toBe("uploads/x.mp3");
      expect(body.data.previewUrl).toBeDefined();
    });
  });
});
