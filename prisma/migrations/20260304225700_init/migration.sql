-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ASSISTANT', 'CONFIRME', 'SUPERVISEUR', 'EXPERT_COMPTABLE');

-- CreateEnum
CREATE TYPE "FormeJuridique" AS ENUM ('SAS', 'SCI', 'SARL', 'EURL', 'SASU', 'EI', 'BNC', 'LMNP', 'SNC', 'SEP', 'SC', 'SOCIETE_CIVILE', 'ASSOCIATION', 'AUTO_ENTREPRENEUR');

-- CreateEnum
CREATE TYPE "RegimeFiscal" AS ENUM ('IS', 'IR');

-- CreateEnum
CREATE TYPE "RegimeTVA" AS ENUM ('RM', 'ST', 'RT', 'EXONERE');

-- CreateEnum
CREATE TYPE "TypeMission" AS ENUM ('SAISIE', 'SAISIE_MENSUELLE', 'SAISIE_TRIMESTRIELLE', 'SAISIE_SEMESTRIELLE', 'SAISIE_ANNUELLE', 'REVISION');

-- CreateEnum
CREATE TYPE "LogicielComptable" AS ENUM ('ACD', 'PENNYLANE', 'SAGE', 'QUADRA', 'TIIME', 'AXONAUT', 'JULY');

-- CreateEnum
CREATE TYPE "SuiviEtape" AS ENUM ('EFFECTUE', 'EN_COURS');

-- CreateEnum
CREATE TYPE "TypeEcheance" AS ENUM ('FISCALE', 'SOCIALE', 'JURIDIQUE');

-- CreateEnum
CREATE TYPE "StatutEcheance" AS ENUM ('A_FAIRE', 'EN_COURS', 'FAIT', 'NON_APPLICABLE');

-- CreateEnum
CREATE TYPE "NiveauAlerte" AS ENUM ('INFO', 'WARNING', 'URGENT', 'CRITIQUE');

-- CreateEnum
CREATE TYPE "TagEmail" AS ENUM ('FISCAL', 'SOCIAL', 'JURIDIQUE', 'ADMIN', 'AUTRE');

-- CreateEnum
CREATE TYPE "NiveauConfiance" AS ENUM ('HAUTE', 'MOYENNE', 'FAIBLE');

-- CreateTable
CREATE TABLE "tenants" (
    "id" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cabinets" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "nom" TEXT NOT NULL,

    CONSTRAINT "cabinets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "prenom" TEXT NOT NULL,
    "nom" TEXT NOT NULL DEFAULT '',
    "email" TEXT,
    "role" "Role" NOT NULL DEFAULT 'ASSISTANT',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "microsoft_id" TEXT,
    "image" TEXT,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "collaborateurs_dossier" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "dossier_id" TEXT NOT NULL,
    "role_on_dossier" TEXT NOT NULL DEFAULT 'secondaire',

    CONSTRAINT "collaborateurs_dossier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dossiers" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "cabinet_id" TEXT NOT NULL,
    "raison_sociale" TEXT NOT NULL,
    "activite" TEXT,
    "nom_contact" TEXT,
    "email_contact" TEXT,
    "telephone_contact" TEXT,
    "siren" TEXT,
    "forme_juridique" "FormeJuridique",
    "regime_fiscal" "RegimeFiscal",
    "type_mission" "TypeMission",
    "logiciel_comptable" "LogicielComptable",
    "commentaire_interne" TEXT,
    "collaborateur_principal_id" TEXT,
    "date_cloture_exercice" DATE,
    "date_prevue_arrete_bilan" DATE,
    "date_arrete_bilan" DATE,
    "commentaire_bilan" TEXT,
    "statut_signature_associe" "SuiviEtape",
    "statut_teledeclaration" "SuiviEtape",
    "statut_2572" "SuiviEtape",
    "statut_das2" "SuiviEtape",
    "statut_verif_jdc" "SuiviEtape",
    "statut_ago" "SuiviEtape",
    "regime_tva" "RegimeTVA",
    "date_limite_tva" INTEGER,
    "tva_suivi" JSONB,
    "taxe_fonciere_note" TEXT,
    "suivi_cfe" TEXT,
    "suivi_cvae" TEXT,
    "suivi_tvs" TEXT,
    "taxe_fonciere_detail" TEXT,
    "acomptes_is" JSONB,
    "solde_is" TEXT,
    "acompte_is_n1" TEXT,
    "acompte_cvae_06" TEXT,
    "acompte_cvae_09" TEXT,
    "solde_cvae" TEXT,
    "statut_2561" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dossiers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "echeances" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "dossier_id" TEXT NOT NULL,
    "libelle" TEXT NOT NULL,
    "type" "TypeEcheance" NOT NULL,
    "date_echeance" DATE NOT NULL,
    "statut" "StatutEcheance" NOT NULL DEFAULT 'A_FAIRE',
    "cle_champ" TEXT,
    "commentaire" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "echeances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alertes" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "dossier_id" TEXT,
    "echeance_id" TEXT,
    "user_id" TEXT,
    "titre" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "niveau" "NiveauAlerte" NOT NULL DEFAULT 'INFO',
    "lue" BOOLEAN NOT NULL DEFAULT false,
    "acquittee" BOOLEAN NOT NULL DEFAULT false,
    "date_alerte" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "alertes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "emails" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "dossier_id" TEXT,
    "user_id" TEXT,
    "microsoft_message_id" TEXT NOT NULL,
    "expediteur" TEXT NOT NULL,
    "destinataires" TEXT[],
    "sujet" TEXT NOT NULL,
    "corps_texte" TEXT,
    "date_reception" TIMESTAMP(3) NOT NULL,
    "resume_ia" TEXT,
    "tag_ia" "TagEmail",
    "urgence_ia" INTEGER,
    "date_detectee_ia" DATE,
    "confiance_match_ia" "NiveauConfiance",
    "rattache_auto" BOOLEAN NOT NULL DEFAULT false,
    "valide" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "emails_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "cabinets_tenant_id_nom_key" ON "cabinets"("tenant_id", "nom");

-- CreateIndex
CREATE UNIQUE INDEX "users_microsoft_id_key" ON "users"("microsoft_id");

-- CreateIndex
CREATE INDEX "users_tenant_id_idx" ON "users"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "users_tenant_id_email_key" ON "users"("tenant_id", "email");

-- CreateIndex
CREATE UNIQUE INDEX "collaborateurs_dossier_user_id_dossier_id_key" ON "collaborateurs_dossier"("user_id", "dossier_id");

-- CreateIndex
CREATE INDEX "dossiers_tenant_id_idx" ON "dossiers"("tenant_id");

-- CreateIndex
CREATE INDEX "dossiers_cabinet_id_idx" ON "dossiers"("cabinet_id");

-- CreateIndex
CREATE INDEX "dossiers_tenant_id_raison_sociale_idx" ON "dossiers"("tenant_id", "raison_sociale");

-- CreateIndex
CREATE INDEX "echeances_tenant_id_idx" ON "echeances"("tenant_id");

-- CreateIndex
CREATE INDEX "echeances_dossier_id_idx" ON "echeances"("dossier_id");

-- CreateIndex
CREATE INDEX "echeances_tenant_id_date_echeance_idx" ON "echeances"("tenant_id", "date_echeance");

-- CreateIndex
CREATE INDEX "alertes_tenant_id_idx" ON "alertes"("tenant_id");

-- CreateIndex
CREATE INDEX "alertes_user_id_lue_idx" ON "alertes"("user_id", "lue");

-- CreateIndex
CREATE UNIQUE INDEX "emails_microsoft_message_id_key" ON "emails"("microsoft_message_id");

-- CreateIndex
CREATE INDEX "emails_tenant_id_idx" ON "emails"("tenant_id");

-- CreateIndex
CREATE INDEX "emails_dossier_id_idx" ON "emails"("dossier_id");

-- AddForeignKey
ALTER TABLE "cabinets" ADD CONSTRAINT "cabinets_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "collaborateurs_dossier" ADD CONSTRAINT "collaborateurs_dossier_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "collaborateurs_dossier" ADD CONSTRAINT "collaborateurs_dossier_dossier_id_fkey" FOREIGN KEY ("dossier_id") REFERENCES "dossiers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dossiers" ADD CONSTRAINT "dossiers_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dossiers" ADD CONSTRAINT "dossiers_cabinet_id_fkey" FOREIGN KEY ("cabinet_id") REFERENCES "cabinets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dossiers" ADD CONSTRAINT "dossiers_collaborateur_principal_id_fkey" FOREIGN KEY ("collaborateur_principal_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "echeances" ADD CONSTRAINT "echeances_dossier_id_fkey" FOREIGN KEY ("dossier_id") REFERENCES "dossiers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alertes" ADD CONSTRAINT "alertes_dossier_id_fkey" FOREIGN KEY ("dossier_id") REFERENCES "dossiers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alertes" ADD CONSTRAINT "alertes_echeance_id_fkey" FOREIGN KEY ("echeance_id") REFERENCES "echeances"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alertes" ADD CONSTRAINT "alertes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "emails" ADD CONSTRAINT "emails_dossier_id_fkey" FOREIGN KEY ("dossier_id") REFERENCES "dossiers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "emails" ADD CONSTRAINT "emails_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
