import { rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const schemaStatements = [
  "PRAGMA foreign_keys = OFF",
  'DROP TABLE IF EXISTS "Alert"',
  'DROP TABLE IF EXISTS "RatingRecord"',
  'DROP TABLE IF EXISTS "RiskEvent"',
  'DROP TABLE IF EXISTS "Enterprise"',
  'DROP TABLE IF EXISTS "User"',
  "PRAGMA foreign_keys = ON",
  `CREATE TABLE "Enterprise" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "uscc" TEXT NOT NULL,
    "legalPerson" TEXT NOT NULL,
    "registeredCapital" REAL NOT NULL,
    "establishedAt" DATETIME NOT NULL,
    "industry" TEXT NOT NULL,
    "region" TEXT NOT NULL,
    "businessScope" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT '在营',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
  )`,
  `CREATE TABLE "RiskEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "enterpriseId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "severity" INTEGER NOT NULL,
    "isVeto" BOOLEAN NOT NULL DEFAULT false,
    "occurredAt" DATETIME NOT NULL,
    "source" TEXT NOT NULL,
    "payload" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RiskEvent_enterpriseId_fkey" FOREIGN KEY ("enterpriseId") REFERENCES "Enterprise" ("id") ON DELETE CASCADE ON UPDATE CASCADE
  )`,
  `CREATE TABLE "RatingRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "enterpriseId" TEXT NOT NULL,
    "score" REAL NOT NULL,
    "level" TEXT NOT NULL,
    "breakdown" TEXT NOT NULL,
    "computedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RatingRecord_enterpriseId_fkey" FOREIGN KEY ("enterpriseId") REFERENCES "Enterprise" ("id") ON DELETE CASCADE ON UPDATE CASCADE
  )`,
  `CREATE TABLE "Alert" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "enterpriseId" TEXT NOT NULL,
    "level" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT '待处置',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Alert_enterpriseId_fkey" FOREIGN KEY ("enterpriseId") REFERENCES "Enterprise" ("id") ON DELETE CASCADE ON UPDATE CASCADE
  )`,
  `CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "username" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'inspector',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  'CREATE UNIQUE INDEX "Enterprise_uscc_key" ON "Enterprise"("uscc")',
  'CREATE INDEX "Enterprise_industry_idx" ON "Enterprise"("industry")',
  'CREATE INDEX "Enterprise_region_idx" ON "Enterprise"("region")',
  'CREATE INDEX "RiskEvent_enterpriseId_idx" ON "RiskEvent"("enterpriseId")',
  'CREATE INDEX "RiskEvent_type_idx" ON "RiskEvent"("type")',
  'CREATE INDEX "RiskEvent_occurredAt_idx" ON "RiskEvent"("occurredAt")',
  'CREATE INDEX "RatingRecord_enterpriseId_idx" ON "RatingRecord"("enterpriseId")',
  'CREATE INDEX "RatingRecord_computedAt_idx" ON "RatingRecord"("computedAt")',
  'CREATE INDEX "Alert_enterpriseId_idx" ON "Alert"("enterpriseId")',
  'CREATE INDEX "Alert_status_idx" ON "Alert"("status")',
  'CREATE UNIQUE INDEX "User_username_key" ON "User"("username")',
];

export async function setupTestDatabase(name: string) {
  const dbPath = join(tmpdir(), `${name}-${process.pid}-${Date.now()}.db`);
  process.env.DATABASE_URL = `file:${dbPath}`;
  const { prisma } = await import("../lib/db");

  for (const statement of schemaStatements) {
    await prisma.$executeRawUnsafe(statement);
  }

  return {
    prisma,
    cleanup: async () => {
      await prisma.$disconnect();
      await rm(dbPath, { force: true });
      await rm(`${dbPath}-journal`, { force: true });
      await rm(`${dbPath}-wal`, { force: true });
      await rm(`${dbPath}-shm`, { force: true });
    },
  };
}
