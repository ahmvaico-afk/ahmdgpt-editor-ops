import { prisma } from "@/lib/prisma";

function slugify(name: string) {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
    .slice(0, 8);
  return base || "editor";
}

export async function generateEditorCode(name: string): Promise<string> {
  const base = slugify(name);
  for (let attempt = 0; attempt < 20; attempt++) {
    const suffix = Math.floor(100 + Math.random() * 900);
    const candidate = `${base}${suffix}`;
    const existing = await prisma.editor.findUnique({ where: { editorCode: candidate } });
    if (!existing) return candidate;
  }
  throw new Error("Could not generate a unique editor code");
}
