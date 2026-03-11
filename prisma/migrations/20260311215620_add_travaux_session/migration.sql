-- CreateTable
CREATE TABLE "travaux_sessions" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "dossier_id" TEXT NOT NULL,
    "outil" TEXT NOT NULL,
    "preparateur" TEXT NOT NULL,
    "statut" TEXT NOT NULL DEFAULT 'EN_COURS',
    "resultat" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "travaux_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "travaux_sessions_tenant_id_dossier_id_idx" ON "travaux_sessions"("tenant_id", "dossier_id");

-- AddForeignKey
ALTER TABLE "travaux_sessions" ADD CONSTRAINT "travaux_sessions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "travaux_sessions" ADD CONSTRAINT "travaux_sessions_dossier_id_fkey" FOREIGN KEY ("dossier_id") REFERENCES "dossiers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
