import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  compress: true,
  reactStrictMode: true,
  // sharp is a native binding loaded at runtime; detect-libc (its dep)
  // requires('child_process') which webpack can't resolve when bundling.
  serverExternalPackages: ["sharp"],
  images: {
    // Source files are already pre-resized webp (saveContentImage produces
    // both full and thumb variants). Skipping the /_next/image optimizer
    // avoids fetch loops behind reverse proxies and the extra sharp call
    // per request.
    unoptimized: true,
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
    // dynamic=0 → on every internal nav, fall through to loading.tsx instead
    // of holding the previous page on screen while the next route fetches.
    // static=300 → keep prefetched static shells warm for 5 min so repeated
    // back/forward navigations are instant.
    staleTimes: {
      dynamic: 0,
      static: 300,
    },
  },
  async rewrites() {
    if (process.env.NODE_ENV === "production") return [];
    const cdn = process.env.CDN_HOSTNAME;
    if (!cdn) return [];
    return [
      {
        source: "/Upload/content/:path*",
        destination: `https://${cdn}/Upload/content/:path*`,
      },
    ];
  },
  async headers() {
    return [
      {
        source: "/Upload/content/:path*",
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
