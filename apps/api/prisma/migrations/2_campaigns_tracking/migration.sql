-- CreateEnum
CREATE TYPE "TemplateSector" AS ENUM ('FINANCEIRO', 'CONTABILIDADE', 'JURIDICO', 'RH', 'TI', 'ADMINISTRATIVO', 'COMPRAS', 'LOGISTICA', 'DIRETORIA', 'GERAL');

-- CreateEnum
CREATE TYPE "CampaignStatus" AS ENUM ('DRAFT', 'SCHEDULED', 'SENDING', 'SENT', 'CANCELED');

-- CreateEnum
CREATE TYPE "PostClickBehavior" AS ENUM ('BLANK', 'EDUCATIONAL', 'FORM');

-- CreateEnum
CREATE TYPE "TrackingEventType" AS ENUM ('SENT', 'OPENED', 'CLICKED', 'ATTACHMENT_OPENED', 'FORM_SUBMITTED', 'REPORTED');

-- CreateEnum
CREATE TYPE "TemplateTrigger" AS ENUM ('LINK', 'ATTACHMENT', 'FORM');

-- AlterTable
ALTER TABLE "email_outbox" ADD COLUMN     "campaignTargetId" TEXT;

-- CreateTable
CREATE TABLE "templates" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sector" "TemplateSector" NOT NULL DEFAULT 'GERAL',
    "trigger" "TemplateTrigger" NOT NULL DEFAULT 'LINK',
    "difficulty" INTEGER NOT NULL DEFAULT 2,
    "subject" TEXT NOT NULL,
    "html" TEXT NOT NULL,
    "landingHtml" TEXT,
    "companyId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "campaigns" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "status" "CampaignStatus" NOT NULL DEFAULT 'DRAFT',
    "scheduledStartAt" TIMESTAMP(3),
    "dripWindowSeconds" INTEGER NOT NULL DEFAULT 0,
    "dripJitterSeconds" INTEGER NOT NULL DEFAULT 0,
    "postClickBehavior" "PostClickBehavior" NOT NULL DEFAULT 'EDUCATIONAL',
    "showReportButton" BOOLEAN NOT NULL DEFAULT false,
    "microTraining" BOOLEAN NOT NULL DEFAULT false,
    "landingRedirectUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "campaigns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "campaign_targets" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "toEmail" TEXT NOT NULL,
    "toName" TEXT,
    "department" TEXT,
    "senderIdentityId" TEXT,
    "outboxId" TEXT,
    "sentAt" TIMESTAMP(3),
    "openedAt" TIMESTAMP(3),
    "clickedAt" TIMESTAMP(3),
    "submittedAt" TIMESTAMP(3),
    "reportedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "campaign_targets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tracking_events" (
    "id" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "type" "TrackingEventType" NOT NULL,
    "ip" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tracking_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "templates_companyId_idx" ON "templates"("companyId");

-- CreateIndex
CREATE INDEX "campaigns_companyId_idx" ON "campaigns"("companyId");

-- CreateIndex
CREATE INDEX "campaigns_status_idx" ON "campaigns"("status");

-- CreateIndex
CREATE UNIQUE INDEX "campaign_targets_token_key" ON "campaign_targets"("token");

-- CreateIndex
CREATE INDEX "campaign_targets_campaignId_idx" ON "campaign_targets"("campaignId");

-- CreateIndex
CREATE INDEX "tracking_events_targetId_idx" ON "tracking_events"("targetId");

-- CreateIndex
CREATE INDEX "tracking_events_type_idx" ON "tracking_events"("type");

-- AddForeignKey
ALTER TABLE "templates" ADD CONSTRAINT "templates_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "templates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaign_targets" ADD CONSTRAINT "campaign_targets_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tracking_events" ADD CONSTRAINT "tracking_events_targetId_fkey" FOREIGN KEY ("targetId") REFERENCES "campaign_targets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

