-- AlterEnum
ALTER TYPE "PostClickBehavior" ADD VALUE 'MICROTRAINING';

-- AlterTable
ALTER TABLE "companies" ADD COLUMN     "allowRecurrence" BOOLEAN NOT NULL DEFAULT false;

