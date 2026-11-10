import { prisma } from "@/lib/prisma";

const DRIVE_ID = /\/file\/d\/([\w-]{10,})|[?&]id=([\w-]{10,})|\/folders\/([\w-]{10,})/;
const NOISE_PARAMS = /^(utm_|usp$|fbclid$|gclid$|resourcekey$)/i;

/** Two links to the same video should produce the same key. */
export function videoLinkKey(raw: string): { key: string; needle: string } {
  const link = raw.trim();
  const drive = link.match(DRIVE_ID);
  if (drive && /drive\.google\.com|docs\.google\.com/i.test(link)) {
    const id = drive[1] ?? drive[2] ?? drive[3];
    return { key: `drive:${id}`, needle: id };
  }

  try {
    const url = new URL(link);
    const host = url.hostname.toLowerCase().replace(/^www\./, "");
    const path = url.pathname.replace(/\/+$/, "").toLowerCase();
    const query = [...url.searchParams.entries()]
      .filter(([name]) => !NOISE_PARAMS.test(name))
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([name, value]) => `${name}=${value}`)
      .join("&");
    return { key: `${host}${path}${query ? `?${query}` : ""}`, needle: `${host}${path}` };
  } catch {
    const lowered = link.toLowerCase();
    return { key: lowered, needle: lowered };
  }
}

/**
 * The video this link was already logged as — any editor, any batch — or null.
 * Compared in code after a coarse database match, so no schema change.
 */
export async function findDuplicateLink(link: string, excludeId?: string) {
  const { key, needle } = videoLinkKey(link);
  const candidates = await prisma.videoSubmission.findMany({
    where: {
      videoLink: { contains: needle, mode: "insensitive" },
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
    select: {
      id: true,
      title: true,
      videoLink: true,
      batchNumber: true,
      editor: { select: { name: true } },
    },
    take: 50,
  });
  return candidates.find((c) => videoLinkKey(c.videoLink).key === key) ?? null;
}

export function duplicateMessage(dup: { title: string; batchNumber: number }) {
  return `This video link was already logged ("${dup.title}", Batch ${dup.batchNumber}). Duplicates aren't allowed.`;
}
