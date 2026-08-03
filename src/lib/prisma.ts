import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

function createClient() {
  const adapter = new PrismaPg({
    connectionString: process.env.DATABASE_URL,
    // A single connection, fully serialized. @prisma/adapter-pg's prepared
    // statements get corrupted when multiple connections are established
    // concurrently under a pool (reproduced repeatedly against both Neon and
    // local Postgres) — at this app's scale (dozens of editors, not
    // thousands), serializing every query through one connection is more
    // reliable than chasing that race, and the latency cost is negligible.
    max: 1,
    // Still recycle a stale idle connection proactively (Neon autosuspend,
    // local `prisma dev` idle reaping) — safe here since max:1 means there's
    // never a second connection establishing concurrently while this happens.
    idleTimeoutMillis: 10_000,
  });
  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

// Warm the pool eagerly so the first real request never has to establish a
// connection from cold — a burst of simultaneous connection setups is what
// triggers prepared-statement corruption in the pg driver adapter.
void prisma.$connect();
