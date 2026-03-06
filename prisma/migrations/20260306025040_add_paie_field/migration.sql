-- AlterTable
ALTER TABLE "dossiers" ADD COLUMN     "paie" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "import_history" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "suivi_revision" ALTER COLUMN "id" DROP DEFAULT;
