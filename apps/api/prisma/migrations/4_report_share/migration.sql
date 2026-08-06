-- AlterTable
ALTER TABLE "campaigns" ADD COLUMN     "reportToken" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "campaigns_reportToken_key" ON "campaigns"("reportToken");

