-- AlterTable
ALTER TABLE "dossiers" ADD COLUMN     "date_archivage" TIMESTAMP(3),
ADD COLUMN     "raison_archivage" TEXT,
ADD COLUMN     "statut" TEXT NOT NULL DEFAULT 'ACTIF';
