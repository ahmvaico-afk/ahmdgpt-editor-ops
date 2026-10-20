import type { Metadata } from "next";
import { ChecklistClient } from "@/components/briefs/checklist-client";

/*
 * Opened from the link QA sends on WhatsApp — deliberately outside the login,
 * the unguessable code is the access. Kept out of search engines.
 */
export const metadata: Metadata = {
  title: "Video Checklist · AHMD.GPT",
  robots: { index: false, follow: false },
};

export default async function ChecklistPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  return <ChecklistClient code={code} />;
}
