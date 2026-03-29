/**
 * Base URL for the site (for RSS, sitemap, canonical URLs).
 * Server-only. Prefer request.nextUrl.origin in route handlers when available.
 */
import "server-only";

function getBaseUrl(): string {
  const vercel = process.env.VERCEL_URL;
  if (vercel) {
    return `https://${vercel}`;
  }
  const site = process.env.SITE_URL ?? process.env.NEXT_PUBLIC_SITE_URL;
  if (site) {
    return site.startsWith("http") ? site : `https://${site}`;
  }
  return "https://localhost:3000";
}

export const siteBaseUrl = getBaseUrl();
