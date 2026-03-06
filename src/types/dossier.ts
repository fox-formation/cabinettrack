// Types métier CabinetTrack — miroir des enums Prisma + types de suivi

export enum FormeJuridiqueLabel {
  SAS = "SAS",
  SCI = "SCI",
  SARL = "SARL",
  EURL = "EURL",
  SASU = "SASU",
  EI = "EI",
  BNC = "BNC",
  LMNP = "LMNP",
  SNC = "SNC",
  SEP = "SEP",
  SC = "SC",
  SOCIETE_CIVILE = "Société Civile",
  ASSOCIATION = "Association",
  AUTO_ENTREPRENEUR = "Auto-Entrepreneur",
}

export const FORME_JURIDIQUE_MAP: Record<string, string> = {
  SAS: "SAS",
  SCI: "SCI",
  SARL: "SARL",
  EURL: "EURL",
  SASU: "SASU",
  EI: "EI",
  BNC: "BNC",
  LMNP: "LMNP",
  SNC: "SNC",
  SEP: "SEP",
  SC: "SC",
  "Société Civile": "SOCIETE_CIVILE",
  Association: "ASSOCIATION",
  "Auto-Entrepreneur": "AUTO_ENTREPRENEUR",
}

export const REGIME_TVA_MAP: Record<string, string> = {
  RM: "RM",
  ST: "ST",
  RT: "RT",
  Exonéré: "EXONERE",
  "Exoneré": "EXONERE",
  EXONERE: "EXONERE",
}

export const TYPE_MISSION_MAP: Record<string, string> = {
  Saisie: "SAISIE",
  "Saisie mensuelle": "SAISIE_MENSUELLE",
  "Saisie trimestrielle": "SAISIE_TRIMESTRIELLE",
  "Saisie semestrielle": "SAISIE_SEMESTRIELLE",
  "Saisie annuelle": "SAISIE_ANNUELLE",
  Révision: "REVISION",
}

export const LOGICIEL_MAP: Record<string, string> = {
  ACD: "ACD",
  Pennylane: "PENNYLANE",
  Sage: "SAGE",
  Quadra: "QUADRA",
  Tiime: "TIIME",
  Axonaut: "AXONAUT",
  July: "JULY",
}

export type SuiviTVAMois = "x" | "X" | "-" | "client" | "FAIT PAR CLIENT" | null

export type SuiviAcompteIS =
  | "x"
  | "X"
  | "-"
  | "<3000€"
  | "Néant"
  | "Déficit"
  | "client"
  | null

export type SuiviCFE = "PE" | "PH" | "PM" | "-" | null

export const MOIS_LABELS = [
  "Janvier",
  "Février",
  "Mars",
  "Avril",
  "Mai",
  "Juin",
  "Juillet",
  "Aout",
  "Septembre",
  "Octobre",
  "Novembre",
  "Décembre",
] as const

export const ETAPES_BILAN = [
  { cle: "statutCourantSaisie",    dbCle: "statut_courant_saisie",     label: "Courant saisie",         poids: 50, hasNote: false },
  { cle: "statutManquantSaisie",   dbCle: "statut_manquant_saisie",    label: "Manquant pour saisie",   poids: 0,  hasNote: true  },
  { cle: "statutRevisionFaite",    dbCle: "statut_revision_faite",     label: "Révision faite",         poids: 10, hasNote: false },
  { cle: "statutOdInventaire",     dbCle: "statut_od_inventaire",      label: "OD inventaire saisie",   poids: 15, hasNote: false },
  { cle: "statutManquantRevision", dbCle: "statut_manquant_revision",  label: "Manquant pour révision", poids: 0,  hasNote: true  },
  { cle: "statutEtatsFinanciers",  dbCle: "statut_etats_financiers",   label: "États financiers",       poids: 4,  hasNote: false },
  { cle: "statutLiasseFiscale",    dbCle: "statut_liasse_fiscale",     label: "Liasse fiscale faite",   poids: 10, hasNote: false },
  { cle: "statutSignatureAssocie", dbCle: "statut_signature_associe",  label: "Signature associé",      poids: 1,  hasNote: false },
  { cle: "statutEnvoiClient",      dbCle: "statut_envoi_client",       label: "Envoi au client",        poids: 5,  hasNote: false },
  { cle: "statutTeledeclaration",  dbCle: "statut_teledeclaration",    label: "Télédéclaration",        poids: 1,  hasNote: false },
  { cle: "statut2572",             dbCle: "statut_2572",               label: "2572",                   poids: 1,  hasNote: false },
  { cle: "statutDas2",             dbCle: "statut_das2",               label: "DAS 2",                  poids: 1,  hasNote: false },
  { cle: "statutVerifEnvoi",       dbCle: "statut_verif_envoi",        label: "Vérif envoi",            poids: 1,  hasNote: false },
  { cle: "statutAgo",              dbCle: "statut_ago",                label: "AGO",                    poids: 1,  hasNote: false },
] as const
