import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";
import { requireQaEditorSession } from "@/lib/auth";

/*
 * Serves the Swipe Lab page and its ad images from assets/swipe-lab — kept out
 * of public/ on purpose so only QA editors can load them, even with a direct
 * link. Only the page itself and ads/<number>.jpg are ever served.
 */
const ROOT = path.join(process.cwd(), "assets", "swipe-lab");

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const session = await requireQaEditorSession();
  if (!session) {
    return new NextResponse("Only QA can open the Swipe Lab.", { status: 403 });
  }

  const rel = (await params).path.join("/");
  let file: string;
  let type: string;
  if (rel === "index.html") {
    file = path.join(ROOT, "index.html");
    type = "text/html; charset=utf-8";
  } else if (/^ads\/\d{6,20}\.jpg$/.test(rel)) {
    file = path.join(ROOT, rel);
    type = "image/jpeg";
  } else {
    return new NextResponse("Not found.", { status: 404 });
  }

  try {
    const body = await readFile(file);
    return new NextResponse(body, {
      headers: { "Content-Type": type, "Cache-Control": "private, no-store" },
    });
  } catch {
    return new NextResponse("Not found.", { status: 404 });
  }
}
