import type { NextConfig } from "next";

// Note: next-intl's optional SWC compile plugin is intentionally not used —
// @swc/core's native binding cache fails strict ACL validation on this
// machine's default Windows AppData permissions. next-intl runs fully
// without the plugin (it is an ICU-optimization only).

const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // next-intl request config (normally aliased by its optional SWC plugin,
  // which we don't use — see note above)
  turbopack: {
    resolveAlias: {
      "next-intl/config": "./src/i18n/request.ts",
    },
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**.supabase.co" },
      { protocol: "https", hostname: "**.supabase.in" },
    ],
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
