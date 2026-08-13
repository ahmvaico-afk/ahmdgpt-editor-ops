import { NextRequest, NextResponse } from "next/server";
import { requireEditorSession } from "@/lib/auth";
import { deletePresetFor, updatePresetFor } from "@/lib/hook/presets";
import { updateHookPresetSchema } from "@/lib/validation";

const FORBIDDEN = "That preset isn't yours to change.";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await requireEditorSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = updateHookPresetSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid preset." }, { status: 400 });
  }

  const result = await updatePresetFor(session.editorId, id, parsed.data);
  if (!result.ok) {
    return NextResponse.json(
      { error: result.status === 404 ? "Preset not found." : FORBIDDEN },
      { status: result.status },
    );
  }
  return NextResponse.json({ preset: result.preset });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await requireEditorSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { id } = await params;
  const result = await deletePresetFor(session.editorId, id);
  if (!result.ok) {
    return NextResponse.json(
      { error: result.status === 404 ? "Preset not found." : FORBIDDEN },
      { status: result.status },
    );
  }
  return NextResponse.json({ ok: true });
}
