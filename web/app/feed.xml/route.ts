import { NextRequest } from "next/server";

import { getEpisodesPublished } from "@/lib/podcast.server";

const RSS_NS = "http://www.itunes.com/dtds/podcast-1.0.dtd";

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function formatDuration(seconds: number | null): string {
  if (seconds == null) return "";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const parts = [];
  if (h > 0) parts.push(h);
  parts.push(m);
  parts.push(s);
  return parts.map((n) => n.toString().padStart(2, "0")).join(":");
}

export async function GET(request: NextRequest) {
  const base = request.nextUrl.origin;
  let episodes: Awaited<ReturnType<typeof getEpisodesPublished>> = [];
  try {
    episodes = await getEpisodesPublished(50, 0);
  } catch {
    // RPC not available yet
  }

  const title = "Podcast";
  const description = "Podcast episodes.";
  const lastBuild = episodes[0]?.published_at ?? new Date().toISOString();

  const items = episodes
    .map((ep) => {
      const link = `${base}/episodes/${ep.slug}`;
      const desc = ep.description ? escapeXml(ep.description) : "";
      const enclosure =
        ep.audio_url && ep.duration_seconds != null
          ? `<enclosure url="${escapeXml(ep.audio_url)}" length="0" type="audio/mpeg"/>`
          : "";
      const itunesImage = ep.image_url
        ? `<itunes:image href="${escapeXml(ep.image_url)}"/>`
        : "";
      const duration = formatDuration(ep.duration_seconds);
      const pubDate = ep.published_at
        ? new Date(ep.published_at).toUTCString()
        : "";
      return `<item>
<title>${escapeXml(ep.title)}</title>
<link>${escapeXml(link)}</link>
<description><![CDATA[${desc}]]></description>
<guid isPermaLink="true">${escapeXml(link)}</guid>
<pubDate>${pubDate}</pubDate>
${enclosure}
${itunesImage}
${duration ? `<itunes:duration>${duration}</itunes:duration>` : ""}
</item>`;
    })
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss xmlns:itunes="${RSS_NS}" version="2.0">
<channel>
<title>${escapeXml(title)}</title>
<link>${escapeXml(base)}</link>
<description>${escapeXml(description)}</description>
<lastBuildDate>${new Date(lastBuild).toUTCString()}</lastBuildDate>
<language>en-us</language>
${items}
</channel>
</rss>`;

  return new Response(xml, {
    headers: {
      "Cache-Control": "public, max-age=300, s-maxage=300",
      "Content-Type": "application/rss+xml; charset=utf-8",
    },
  });
}
