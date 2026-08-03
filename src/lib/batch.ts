import { prisma } from "@/lib/prisma";

const SETTINGS_ID = "singleton";

export async function getCurrentBatch(): Promise<number> {
  const settings = await prisma.appSettings.upsert({
    where: { id: SETTINGS_ID },
    update: {},
    create: { id: SETTINGS_ID },
  });
  return settings.currentBatch;
}

export async function setCurrentBatch(batch: number): Promise<number> {
  const settings = await prisma.appSettings.upsert({
    where: { id: SETTINGS_ID },
    update: { currentBatch: batch },
    create: { id: SETTINGS_ID, currentBatch: batch },
  });
  return settings.currentBatch;
}
