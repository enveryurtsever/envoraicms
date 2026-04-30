import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  compress: true,
  reactStrictMode: true,
  images: {
    formats: ["image/avif", "image/webp"],
    minimumCacheTTL: 60 * 60 * 24 * 30,
    remotePatterns: process.env.CDN_HOSTNAME
      ? [{ protocol: "https", hostname: process.env.CDN_HOSTNAME }]
      : [],
  },
  experimental: {
    optimizePackageImports: ["embla-carousel-react"],
    serverActions: {
      bodySizeLimit: "6mb",
    },
  },
  async rewrites() {
    if (process.env.NODE_ENV === "production") return [];
    const cdn = process.env.CDN_HOSTNAME;
    if (!cdn) return [];
    return [
      { source: "/Content/:path*", destination: `https://${cdn}/Content/:path*` },
    ];
  },
  async headers() {
    return [
      {
        source: "/Content/:path*",
        headers: [
          { key: "Cache-Control", value: "public, max-age=2592000, immutable" },
        ],
      },
      {
        source: "/Upload/:path*",
        headers: [
          { key: "Cache-Control", value: "public, max-age=2592000" },
        ],
      },
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
