/*
  Warnings:

  - You are about to drop the column `statut_verif_jdc` on the `dossiers` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "dossiers" DROP COLUMN "statut_verif_jdc",
ADD COLUMN     "note_manquant_revision" TEXT,
ADD COLUMN     "note_manquant_saisie" TEXT,
ADD COLUMN     "statut_courant_saisie" "SuiviEtape",
ADD COLUMN     "statut_envoi_client" "SuiviEtape",
ADD COLUMN     "statut_etats_financiers" "SuiviEtape",
ADD COLUMN     "statut_liasse_fiscale" "SuiviEtape",
ADD COLUMN     "statut_manquant_revision" "SuiviEtape",
ADD COLUMN     "statut_manquant_saisie" "SuiviEtape",
ADD COLUMN     "statut_od_inventaire" "SuiviEtape",
ADD COLUMN     "statut_revision_faite" "SuiviEtape",
ADD COLUMN     "statut_verif_envoi" "SuiviEtape";
