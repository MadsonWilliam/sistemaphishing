-- AlterEnum
ALTER TYPE "LeadStage" ADD VALUE 'ESTRUTURA_CAMPANHA';

-- AlterTable
ALTER TABLE "leads" ADD COLUMN     "contactsRequestedAt" TIMESTAMP(3),
ADD COLUMN     "proposalConditions" TEXT,
ADD COLUMN     "proposalPlan" TEXT,
ADD COLUMN     "proposalSentAt" TIMESTAMP(3),
ADD COLUMN     "proposalValue" TEXT;


-- Data: move leads do estágio legado CONTATADO para QUALIFICADO (fluxo novo).
UPDATE "leads" SET "stage" = 'QUALIFICADO' WHERE "stage" = 'CONTATADO';
