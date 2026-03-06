-- CreateEnum
CREATE TYPE "StatutRevision" AS ENUM ('RAS', 'DEMANDE_CLIENT', 'ACTION_REQUISE');

-- CreateTable
CREATE TABLE "suivi_revision" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "tenant_id" TEXT NOT NULL,
    "dossier_id" TEXT NOT NULL,
    "date_contact" DATE NOT NULL,
    "collaborateur_id" TEXT,
    "resume" TEXT,
    "statut" "StatutRevision" NOT NULL DEFAULT 'RAS',
    "prochain_contact" DATE,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "suivi_revision_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "suivi_revision_tenant_id_dossier_id_idx" ON "suivi_revision"("tenant_id", "dossier_id");

-- AddForeignKey
ALTER TABLE "suivi_revision" ADD CONSTRAINT "suivi_revision_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "suivi_revision" ADD CONSTRAINT "suivi_revision_dossier_id_fkey" FOREIGN KEY ("dossier_id") REFERENCES "dossiers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "suivi_revision" ADD CONSTRAINT "suivi_revision_collaborateur_id_fkey" FOREIGN KEY ("collaborateur_id") REFERENCES "collaborateurs_dossier"("id") ON DELETE SET NULL ON UPDATE CASCADE;
