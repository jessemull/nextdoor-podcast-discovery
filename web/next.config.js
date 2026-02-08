/** @type {import('next').NextConfig} */
const nextConfig = {
  // Enable strict mode for better development experience
  reactStrictMode: true,
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
};

module.exports = nextConfig;
