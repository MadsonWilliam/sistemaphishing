-- CreateEnum
CREATE TYPE "LeadStage" AS ENUM ('NOVO', 'CONTATADO', 'QUALIFICADO', 'PROPOSTA', 'GANHO', 'PERDIDO');

-- AlterTable
ALTER TABLE "leads" ADD COLUMN     "notes" TEXT,
ADD COLUMN     "stage" "LeadStage" NOT NULL DEFAULT 'NOVO',
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateIndex
CREATE INDEX "leads_stage_idx" ON "leads"("stage");

