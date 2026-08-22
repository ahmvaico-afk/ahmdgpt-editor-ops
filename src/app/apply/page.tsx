import type { Metadata } from "next";
import { ApplyClient } from "@/components/apply/apply-client";

/**
 * Public — no session, no proxy guard (the matcher only covers /admin and
 * /portal). This link gets shared on a story, so the OG tags matter as much as
 * the page does.
 */
export const metadata: Metadata = {
  title: "AHMD.GPT — We're hiring video editors",
  description:
    "AI UGC ads for brands. Paid per video, work from anywhere. Two-minute application.",
  openGraph: {
    title: "AHMD.GPT — We're hiring video editors",
    description: "AI UGC ads for brands. Paid per video, work from anywhere.",
    type: "website",
  },
  robots: { index: true, follow: true },
};

export default function ApplyPage() {
  return <ApplyClient />;
}
