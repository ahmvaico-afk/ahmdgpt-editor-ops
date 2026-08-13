import { NextRequest, NextResponse } from "next/server";
import { requireEditorSession } from "@/lib/auth";
import { createPresetFor, listPresetsFor } from "@/lib/hook/presets";
import { createHookPresetSchema } from "@/lib/validation";

/** Editor-only: presets are personal, and admins have no portal to use them in. */
export async function GET() {
  const session = await requireEditorSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  const presets = await listPresetsFor(session.editorId);
  return NextResponse.json({ presets });
}

export async function POST(request: NextRequest) {
  const session = await requireEditorSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = createHookPresetSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Give the preset a name." }, { status: 400 });
  }

  // Owner comes from the session, never from the body — a client cannot create
  // a preset under someone else's name or promote one to global.
  const preset = await createPresetFor(session.editorId, parsed.data.name, parsed.data.config);
  return NextResponse.json({ preset }, { status: 201 });
}
