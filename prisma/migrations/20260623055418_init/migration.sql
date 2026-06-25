-- CreateTable
CREATE TABLE "Enterprise" (
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
);

-- CreateTable
CREATE TABLE "RiskEvent" (
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
);

-- CreateTable
CREATE TABLE "RatingRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "enterpriseId" TEXT NOT NULL,
    "score" REAL NOT NULL,
    "level" TEXT NOT NULL,
    "breakdown" TEXT NOT NULL,
    "computedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RatingRecord_enterpriseId_fkey" FOREIGN KEY ("enterpriseId") REFERENCES "Enterprise" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Alert" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "enterpriseId" TEXT NOT NULL,
    "level" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT '待处置',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Alert_enterpriseId_fkey" FOREIGN KEY ("enterpriseId") REFERENCES "Enterprise" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "username" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'inspector',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "Enterprise_uscc_key" ON "Enterprise"("uscc");

-- CreateIndex
CREATE INDEX "Enterprise_industry_idx" ON "Enterprise"("industry");

-- CreateIndex
CREATE INDEX "Enterprise_region_idx" ON "Enterprise"("region");

-- CreateIndex
CREATE INDEX "RiskEvent_enterpriseId_idx" ON "RiskEvent"("enterpriseId");

-- CreateIndex
CREATE INDEX "RiskEvent_type_idx" ON "RiskEvent"("type");

-- CreateIndex
CREATE INDEX "RiskEvent_occurredAt_idx" ON "RiskEvent"("occurredAt");

-- CreateIndex
CREATE INDEX "RatingRecord_enterpriseId_idx" ON "RatingRecord"("enterpriseId");

-- CreateIndex
CREATE INDEX "RatingRecord_computedAt_idx" ON "RatingRecord"("computedAt");

-- CreateIndex
CREATE INDEX "Alert_enterpriseId_idx" ON "Alert"("enterpriseId");

-- CreateIndex
CREATE INDEX "Alert_status_idx" ON "Alert"("status");

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");
