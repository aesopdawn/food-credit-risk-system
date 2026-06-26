-- AlterTable
ALTER TABLE "Alert" ADD COLUMN "disposition" TEXT;
ALTER TABLE "Alert" ADD COLUMN "dispositionType" TEXT;
ALTER TABLE "Alert" ADD COLUMN "handledAt" DATETIME;
ALTER TABLE "Alert" ADD COLUMN "handledBy" TEXT;
