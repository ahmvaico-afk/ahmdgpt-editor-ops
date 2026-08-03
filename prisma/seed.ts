import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const DEFAULT_STYLES = [
  // Rates are per-minute, in paisa (PKR minor unit): 60000 = Rs 600/min.
  // Real pricing as given: Veo 3 Only 600/min flat; Talking head with
  // B-Rolls 2000/min + a flat 500 add-on for every minute after the first
  // (assumed reading of "500 increase every next minute" — flag if wrong);
  // Faceless 2000/min flat.
  { name: "Veo 3 Only", ratePerMinuteCents: 60000, sortOrder: 0 },
  // Rs 2000/min base, +Rs 500 flat for every minute after the first.
  {
    name: "Talking head with B-Rolls",
    ratePerMinuteCents: 200000,
    perMinuteIncrementCents: 50000,
    sortOrder: 1,
  },
  { name: "Faceless", ratePerMinuteCents: 200000, sortOrder: 2 },
  { name: "Custom", isCustomPricing: true, ratePerMinuteCents: null, sortOrder: 3 },
];

async function main() {
  const adminName = process.env.ADMIN_NAME ?? "Owner";
  const adminCode = process.env.ADMIN_CODE ?? "owner";
  const adminPin = process.env.ADMIN_PIN ?? "123456";

  const pinHash = await bcrypt.hash(adminPin, 12);
  await prisma.adminUser.upsert({
    where: { loginCode: adminCode },
    update: { name: adminName, pinHash },
    create: { name: adminName, loginCode: adminCode, pinHash, role: "owner" },
  });
  console.log(`Admin ready: login code "${adminCode}"`);

  for (const style of DEFAULT_STYLES) {
    await prisma.videoStyle.upsert({
      where: { id: `seed-${style.name.toLowerCase().replace(/\s+/g, "-")}` },
      update: {},
      create: {
        id: `seed-${style.name.toLowerCase().replace(/\s+/g, "-")}`,
        name: style.name,
        isCustomPricing: style.isCustomPricing ?? false,
        ratePerMinuteCents: style.ratePerMinuteCents ?? null,
        perMinuteIncrementCents: style.perMinuteIncrementCents ?? 0,
        sortOrder: style.sortOrder,
      },
    });
  }
  console.log(`Seeded ${DEFAULT_STYLES.length} default video styles`);

  // Doesn't touch currentBatch if it's already set — only sets it the first time.
  await prisma.appSettings.upsert({
    where: { id: "singleton" },
    update: {},
    create: { id: "singleton", currentBatch: 4 },
  });
  console.log("Batch counter ready");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
