-- CreateEnum
CREATE TYPE "RecurrenceRule" AS ENUM ('NONE', 'WEEKLY', 'MONTHLY', 'QUARTERLY');

-- AlterTable
ALTER TABLE "campaigns" ADD COLUMN     "brandColor" TEXT,
ADD COLUMN     "brandLogoUrl" TEXT,
ADD COLUMN     "nextRunAt" TIMESTAMP(3),
ADD COLUMN     "recurrence" "RecurrenceRule" NOT NULL DEFAULT 'NONE',
ADD COLUMN     "recurringParentId" TEXT,
ADD COLUMN     "senderIds" TEXT[],
ADD COLUMN     "trainingUrl" TEXT;

