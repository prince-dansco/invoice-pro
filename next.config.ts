import type { NextConfig } from "next";

const securityHeaders = [
  // Nobody may embed the app in a frame (clickjacking). No form-action: Chrome
  // applies it to the redirect after a form submit, which would block Google sign-in.
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'; base-uri 'self'; object-src 'none'" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
];

const nextConfig: NextConfig = {
  // Lets a production build for local testing (NEXT_DIST_DIR=.next-test) sit
  // beside `pnpm dev`, which would otherwise overwrite it in .next.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  experimental: {
    // Logos are capped at 1 MB; leave headroom for the multipart envelope.
    serverActions: { bodySizeLimit: "2mb" },
  },
  // The PDF renderer and image converter load native code and font files at runtime.
  serverExternalPackages: ["@react-pdf/renderer", "sharp"],
  // Ship the PDF fonts with the PDF route when deployed.
  outputFileTracingIncludes: {
    "/invoices/[id]/pdf": ["./src/assets/fonts/**"],
  },
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
