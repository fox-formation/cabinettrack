-- CreateTable
CREATE TABLE "suivi_courants" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "dossier_id" TEXT NOT NULL,
    "periode" TEXT NOT NULL,
    "saisie_achat" "SuiviEtape",
    "saisie_vente" "SuiviEtape",
    "saisie_banque" "SuiviEtape",
    "lettrage" "SuiviEtape",
    "paie_saisie" "SuiviEtape",
    "paie_revision" "SuiviEtape",
    "tva_declaree" "SuiviEtape",
    "capitaux_propres" "SuiviEtape",
    "note_periode" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "suivi_courants_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "suivi_courants_tenant_id_dossier_id_idx" ON "suivi_courants"("tenant_id", "dossier_id");

-- CreateIndex
CREATE UNIQUE INDEX "suivi_courants_tenant_id_dossier_id_periode_key" ON "suivi_courants"("tenant_id", "dossier_id", "periode");

-- AddForeignKey
ALTER TABLE "suivi_courants" ADD CONSTRAINT "suivi_courants_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "suivi_courants" ADD CONSTRAINT "suivi_courants_dossier_id_fkey" FOREIGN KEY ("dossier_id") REFERENCES "dossiers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
