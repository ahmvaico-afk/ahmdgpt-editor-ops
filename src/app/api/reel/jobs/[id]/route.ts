import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/auth";
import { discardJob, getJob, serializeJob } from "@/lib/reel/jobs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Progress poll target while a render is running. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await requireAdminSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { id } = await params;
  const job = getJob(id);
  if (!job) {
    return NextResponse.json({ error: "Job not found." }, { status: 404 });
  }

  return NextResponse.json({ job: serializeJob(job) });
}

/** Used by REPLACE VIDEO so temp files don't pile up until the sweeper runs. */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await requireAdminSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { id } = await params;
  await discardJob(id);
  return NextResponse.json({ ok: true });
}
