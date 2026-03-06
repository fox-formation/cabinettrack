-- CreateEnum
CREATE TYPE "StatutCollab" AS ENUM ('ACTIF', 'ARCHIVE');

-- AlterTable
ALTER TABLE "users" ADD COLUMN "statut" "StatutCollab" NOT NULL DEFAULT 'ACTIF',
ADD COLUMN "date_arrivee" DATE,
ADD COLUMN "date_fin_contrat" DATE;
