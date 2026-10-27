"use client";

import dynamic from "next/dynamic";

// Browser-only (canvas, WebCodecs, saved settings), so it skips server rendering.
export const AdResizer = dynamic(
  () => import("@/components/portal/ad-resizer-client").then((m) => m.AdResizerClient),
  {
    ssr: false,
    loading: () => <p className="px-6 py-10 text-center text-sm text-muted">Loading Ad Resizer…</p>,
  }
);
