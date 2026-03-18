-- AlterTable
ALTER TABLE "tenants" ADD COLUMN     "domaines" TEXT[] DEFAULT ARRAY[]::TEXT[];
