-- CreateEnum
CREATE TYPE "SensContact" AS ENUM ('SORTANT', 'ENTRANT');

-- AlterTable
ALTER TABLE "suivi_revision" ADD COLUMN     "sens" "SensContact" NOT NULL DEFAULT 'SORTANT',
ADD COLUMN     "sujet" VARCHAR(255);
