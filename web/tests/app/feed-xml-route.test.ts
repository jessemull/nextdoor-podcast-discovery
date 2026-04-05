import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { GET } from "@/app/feed.xml/route";

vi.mock("@/lib/podcast.server", () => ({
  getEpisodesPublished: vi.fn(),
}));

import { getEpisodesPublished } from "@/lib/podcast.server";

describe("GET /feed.xml", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return application/rss+xml and rss root when no episodes", async () => {
    vi.mocked(getEpisodesPublished).mockResolvedValue([]);

    const request = new NextRequest("https://example.com/feed.xml");
    const response = await GET(request);
    const text = await response.text();

    expect(response.headers.get("Content-Type")).toContain("application/rss+xml");
    expect(text).toContain("<rss ");
    expect(text).toContain("<channel>");
    expect(text).toContain("Podcast");
  });

  it("should escape XML in episode titles and descriptions", async () => {
    vi.mocked(getEpisodesPublished).mockResolvedValue([
      {
        audio_url: "https://cdn.example.com/a.mp3",
        description: 'Say "hi" & <bye>',
        duration_seconds: 125,
        image_url: "https://img.example.com/i.jpg",
        published_at: "2025-01-01T12:00:00.000Z",
        slug: "ep-1",
        title: "Tom & Jerry <special>",
      },
    ] as never);

    const request = new NextRequest("https://example.com/feed.xml");
    const response = await GET(request);
    const text = await response.text();

    expect(text).toContain("Tom &amp; Jerry &lt;special&gt;");
    expect(text).not.toContain("Tom & Jerry <special>");
    expect(text).toContain("Say &quot;hi&quot; &amp; &lt;bye&gt;");
  });

  it("should swallow errors from getEpisodesPublished and still return rss", async () => {
    vi.mocked(getEpisodesPublished).mockRejectedValue(new Error("RPC down"));

    const request = new NextRequest("https://example.com/feed.xml");
    const response = await GET(request);
    const text = await response.text();

    expect(response.status).toBe(200);
    expect(text).toContain("<rss ");
  });
});
