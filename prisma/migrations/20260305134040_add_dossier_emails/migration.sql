-- CreateTable
CREATE TABLE "dossier_emails" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "dossier_id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "label" TEXT,
    "ordre" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dossier_emails_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "dossier_emails_tenant_id_dossier_id_idx" ON "dossier_emails"("tenant_id", "dossier_id");

-- AddForeignKey
ALTER TABLE "dossier_emails" ADD CONSTRAINT "dossier_emails_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dossier_emails" ADD CONSTRAINT "dossier_emails_dossier_id_fkey" FOREIGN KEY ("dossier_id") REFERENCES "dossiers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
