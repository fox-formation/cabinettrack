-- CreateTable
CREATE TABLE "fec_imports" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "dossier_id" TEXT NOT NULL,
    "exercice" INTEGER NOT NULL,
    "nom_fichier" TEXT NOT NULL,
    "nb_lignes" INTEGER NOT NULL,
    "chiffre_affaires" DOUBLE PRECISION,
    "resultat" DOUBLE PRECISION,
    "montant_is" DOUBLE PRECISION,
    "total_charges" DOUBLE PRECISION,
    "total_produits" DOUBLE PRECISION,
    "suggestions_ia" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fec_imports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "fec_imports_tenant_id_dossier_id_idx" ON "fec_imports"("tenant_id", "dossier_id");

-- CreateIndex
CREATE UNIQUE INDEX "fec_imports_tenant_id_dossier_id_exercice_key" ON "fec_imports"("tenant_id", "dossier_id", "exercice");

-- AddForeignKey
ALTER TABLE "fec_imports" ADD CONSTRAINT "fec_imports_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fec_imports" ADD CONSTRAINT "fec_imports_dossier_id_fkey" FOREIGN KEY ("dossier_id") REFERENCES "dossiers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
