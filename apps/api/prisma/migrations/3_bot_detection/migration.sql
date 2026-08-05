-- AlterTable
ALTER TABLE "tracking_events" ADD COLUMN     "botReason" TEXT,
ADD COLUMN     "isBot" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "tracking_events_isBot_idx" ON "tracking_events"("isBot");

