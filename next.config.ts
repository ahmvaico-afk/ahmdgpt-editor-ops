import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /*
   * These carry native binaries (libvips, resvg, the FFmpeg executables) and
   * must be `require`d at runtime rather than bundled into the server build.
   */
  serverExternalPackages: [
    "sharp",
    "@resvg/resvg-js",
    "@ffmpeg-installer/ffmpeg",
    "@ffprobe-installer/ffprobe",
  ],

  /*
   * The reel compositor reads the brand TTFs from disk at runtime, so they have
   * to travel with a traced/standalone build.
   */
  outputFileTracingIncludes: {
    "/admin/reel": ["./assets/reel-fonts/**"],
    "/api/reel/**": ["./assets/reel-fonts/**"],
    // Swipe Lab page and ad images, served QA-only by /api/swipe-lab/files.
    "/api/swipe-lab/files/**": ["./assets/swipe-lab/**"],
  },
};

export default nextConfig;
