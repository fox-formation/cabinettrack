-- AlterTable
ALTER TABLE "suivi_courants"
ADD COLUMN IF NOT EXISTS "lettrage_vente" "SuiviEtape" DEFAULT NULL,
ADD COLUMN IF NOT EXISTS "compte_attente_ok" "SuiviEtape" DEFAULT NULL;
