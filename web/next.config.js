/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // Default 10MB truncates large multipart bodies; truncated uploads fail with
    // "Failed to parse body as FormData". Keep above podcast upload max (100MB
    // in app/api/admin/podcast/upload/route.ts) plus multipart overhead.
    // https://nextjs.org/docs/app/api-reference/config/next-config-js/middlewareClientMaxBodySize
    proxyClientMaxBodySize: "110mb",
  },
  images: {
    remotePatterns: [
      {
        hostname: "nextdoor.com",
        pathname: "/**",
        protocol: "https",
      },
      {
        hostname: "*.nextdoor.com",
        pathname: "/**",
        protocol: "https",
      },
      {
        hostname: "*.cloudfront.net",
        pathname: "/**",
        protocol: "https",
      },
      {
        hostname: "*.amazonaws.com",
        pathname: "/**",
        protocol: "https",
      },
    ],
  },
  reactStrictMode: true,
};

module.exports = nextConfig;
