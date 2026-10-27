import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  distDir: process.env.CMMS_BUILD_DIR || ".next",
  /* config options here */
  allowedDevOrigins: ["192.168.1.114"],
  async headers() {
    return [
      {
        source: "/sw.js",
        headers: [
          {
            key: "Cache-Control",
            value: "no-cache, no-store, must-revalidate",
          },
          {
            key: "Content-Type",
            value: "application/javascript; charset=utf-8",
          },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
      {
        source: "/manifest.webmanifest",
        headers: [
          { key: "Content-Type", value: "application/manifest+json" },
          { key: "Cache-Control", value: "no-cache" },
        ],
      },
    ];
  },
  //allowedDevOrigins: ["192.168.1.114"],
};

export default nextConfig;
