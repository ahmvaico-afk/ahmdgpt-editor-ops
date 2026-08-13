/**
 * Server-side preset access. Every read and write is scoped to the calling
 * editor here rather than in the route handlers, so there is one place where
 * ownership is decided and no handler can forget to check.
 */
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { DEFAULT_PRESET_NAME, HOUSE_STYLE, normalizeConfig, type HookConfig } from "./spec";

/**
 * HookConfig is a closed interface; Prisma's Json input wants an open index
 * signature. The values are all primitives, so the widening is safe.
 */
function toJson(config: HookConfig): Prisma.InputJsonObject {
  return { ...config } as unknown as Prisma.InputJsonObject;
}

export interface SerializedPreset {
  id: string;
  name: string;
  isDefault: boolean;
  /** True when the calling editor may rename, restyle, or delete it. */
  editable: boolean;
  config: HookConfig;
}

type PresetRow = {
  id: string;
  name: string;
  isDefault: boolean;
  ownerEditorId: string | null;
  config: unknown;
};

function serialize(row: PresetRow, editorId: string): SerializedPreset {
  return {
    id: row.id,
    name: row.name,
    isDefault: row.isDefault,
    // The global default is read-only for everyone, including its own creator.
    editable: !row.isDefault && row.ownerEditorId === editorId,
    config: normalizeConfig(row.config),
  };
}

/**
 * Creates the built-in house style on first use rather than in the seed, so an
 * already-deployed database picks it up without anyone running a script.
 * Idempotent: concurrent callers can race, and the loser just reads the winner's row.
 */
export async function ensureDefaultPreset(): Promise<void> {
  const existing = await prisma.hookPreset.findFirst({ where: { isDefault: true } });
  if (existing) return;
  try {
    await prisma.hookPreset.create({
      data: {
        name: DEFAULT_PRESET_NAME,
        isDefault: true,
        ownerEditorId: null,
        config: toJson(HOUSE_STYLE),
      },
    });
  } catch {
    // Another request created it between the read and the write — fine.
  }
}

/** The global default plus this editor's own, default first then newest. */
export async function listPresetsFor(editorId: string): Promise<SerializedPreset[]> {
  await ensureDefaultPreset();
  const rows = await prisma.hookPreset.findMany({
    where: { OR: [{ isDefault: true }, { ownerEditorId: editorId }] },
    orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
  });
  return rows.map((row) => serialize(row, editorId));
}

export async function createPresetFor(
  editorId: string,
  name: string,
  config: unknown,
): Promise<SerializedPreset> {
  const row = await prisma.hookPreset.create({
    data: {
      name,
      isDefault: false,
      ownerEditorId: editorId,
      config: toJson(normalizeConfig(config)),
    },
  });
  return serialize(row, editorId);
}

export type PresetWriteResult =
  | { ok: true; preset: SerializedPreset }
  | { ok: false; status: 404 | 403 };

/**
 * Looks the preset up *by owner as well as id*, so another editor's id simply
 * doesn't match — there is no window where we hold someone else's row and then
 * decide whether to allow the write.
 */
export async function updatePresetFor(
  editorId: string,
  id: string,
  patch: { name?: string; config?: unknown },
): Promise<PresetWriteResult> {
  const existing = await prisma.hookPreset.findUnique({ where: { id } });
  if (!existing) return { ok: false, status: 404 };
  if (existing.isDefault || existing.ownerEditorId !== editorId) return { ok: false, status: 403 };

  const row = await prisma.hookPreset.update({
    where: { id },
    data: {
      ...(patch.name !== undefined ? { name: patch.name } : {}),
      ...(patch.config !== undefined ? { config: toJson(normalizeConfig(patch.config)) } : {}),
    },
  });
  return { ok: true, preset: serialize(row, editorId) };
}

export async function deletePresetFor(
  editorId: string,
  id: string,
): Promise<{ ok: true } | { ok: false; status: 404 | 403 }> {
  const existing = await prisma.hookPreset.findUnique({ where: { id } });
  if (!existing) return { ok: false, status: 404 };
  if (existing.isDefault || existing.ownerEditorId !== editorId) return { ok: false, status: 403 };
  await prisma.hookPreset.delete({ where: { id } });
  return { ok: true };
}
