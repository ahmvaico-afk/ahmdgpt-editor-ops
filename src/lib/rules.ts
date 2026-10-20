import { prisma } from "@/lib/prisma";

const SETTINGS_ID = "singleton";

/** The active checklist, in the order editors tick it. */
export async function getActiveRules() {
  return prisma.clientRule.findMany({
    where: { active: true },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });
}

export async function getMinLoudnessLufs(): Promise<number> {
  const settings = await prisma.appSettings.upsert({
    where: { id: SETTINGS_ID },
    update: {},
    create: { id: SETTINGS_ID },
  });
  return settings.minLoudnessLufs;
}

export async function setMinLoudnessLufs(value: number): Promise<number> {
  const settings = await prisma.appSettings.upsert({
    where: { id: SETTINGS_ID },
    update: { minLoudnessLufs: value },
    create: { id: SETTINGS_ID, minLoudnessLufs: value },
  });
  return settings.minLoudnessLufs;
}
