-- AlterTable
ALTER TABLE "dossiers" ADD COLUMN     "groupe_id" TEXT;

-- CreateTable
CREATE TABLE "groupes" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "groupes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "groupes_tenant_id_code_key" ON "groupes"("tenant_id", "code");

-- CreateIndex
CREATE INDEX "dossiers_groupe_id_idx" ON "dossiers"("groupe_id");

-- AddForeignKey
ALTER TABLE "dossiers" ADD CONSTRAINT "dossiers_groupe_id_fkey" FOREIGN KEY ("groupe_id") REFERENCES "groupes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "groupes" ADD CONSTRAINT "groupes_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
