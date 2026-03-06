/**
 * Moteur de calcul des échéances fiscales, sociales et juridiques.
 *
 * Toutes les dates sont calculées depuis `date_cloture_exercice` du dossier
 * (jamais hard-codées au 31/12) pour gérer les 37 clôtures décalées.
 */

import { addMonths, setDate, addDays } from "date-fns"
import type { Dossier } from "@prisma/client"

export interface EcheanceCalculee {
  libelle: string
  type: "FISCALE" | "SOCIALE" | "JURIDIQUE"
  dateEcheance: Date
  cleChamp?: string
}

const MOIS = [
  "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre",
]

// ──────────────────────────────────────────────
// TVA
// ──────────────────────────────────────────────

export function calculerEcheancesTVA(
  dossier: Dossier,
  annee: number
): EcheanceCalculee[] {
  if (!dossier.regimeTva || dossier.regimeTva === "EXONERE") return []

  const j = dossier.dateLimiteTva ?? 24

  switch (dossier.regimeTva) {
    case "RM": {
      // CA3 mensuelle : 1 échéance par mois, le jour j du mois M+1
      return Array.from({ length: 12 }, (_, i) => ({
        libelle: `TVA CA3 ${MOIS[i]} ${annee}`,
        type: "FISCALE" as const,
        dateEcheance: setDate(addMonths(new Date(annee, i, 1), 1), j),
        cleChamp: `tva_${String(i + 1).padStart(2, "0")}`,
      }))
    }

    case "RT": {
      // CA3 trimestrielle : jour j du mois suivant chaque fin de trimestre
      return [3, 6, 9, 12].map((moisFin, idx) => ({
        libelle: `TVA CA3 T${idx + 1} ${annee}`,
        type: "FISCALE" as const,
        dateEcheance: setDate(addMonths(new Date(annee, moisFin - 1, 1), 1), j),
        cleChamp: `tva_t${idx + 1}`,
      }))
    }

    case "ST": {
      // Simplifié : 2 acomptes + 1 solde annuel (CA12)
      return [
        {
          libelle: `Acompte TVA Juillet (55%) ${annee}`,
          type: "FISCALE" as const,
          dateEcheance: setDate(new Date(annee, 6, 1), j),
          cleChamp: "tva_acompte_07",
        },
        {
          libelle: `Acompte TVA Décembre (40%) ${annee}`,
          type: "FISCALE" as const,
          dateEcheance: setDate(new Date(annee, 11, 1), j),
          cleChamp: "tva_acompte_12",
        },
        {
          libelle: `CA12 — Solde TVA annuel ${annee}`,
          type: "FISCALE" as const,
          dateEcheance: setDate(new Date(annee + 1, 4, 1), j),
          cleChamp: "tva_ca12",
        },
      ]
    }

    default:
      return []
  }
}

// ──────────────────────────────────────────────
// IS — Acomptes et liasse
// ──────────────────────────────────────────────

export function calculerEcheancesIS(dossier: Dossier): EcheanceCalculee[] {
  if (dossier.regimeFiscal !== "IS") return []
  if (!dossier.dateClotureExercice) return []

  const c = new Date(dossier.dateClotureExercice)

  // Vérifier si le dossier est dispensé d'acomptes
  const acomptes = dossier.acomptesIs as Record<string, string | null> | null
  const dispense =
    acomptes &&
    Object.values(acomptes).some(
      (v) => v === "<3000€" || v === "Néant" || v === "Déficit"
    )

  const echeances: EcheanceCalculee[] = []

  if (!dispense) {
    // Acompte 1 : 3ème mois + 15j après clôture
    echeances.push({
      libelle: "Acompte IS n°1 (8.33%)",
      type: "FISCALE",
      dateEcheance: addDays(addMonths(c, 3), 15),
      cleChamp: "acpt_is_1",
    })
    // Acompte 2 : 6ème mois + 15j
    echeances.push({
      libelle: "Acompte IS n°2 (8.33%)",
      type: "FISCALE",
      dateEcheance: addDays(addMonths(c, 6), 15),
      cleChamp: "acpt_is_2",
    })
    // Acompte 3 : 9ème mois + 15j
    echeances.push({
      libelle: "Acompte IS n°3 (8.33%)",
      type: "FISCALE",
      dateEcheance: addDays(addMonths(c, 9), 15),
      cleChamp: "acpt_is_3",
    })
    // Acompte 4 : 12ème mois + 15j
    echeances.push({
      libelle: "Acompte IS n°4 (8.33%)",
      type: "FISCALE",
      dateEcheance: addDays(addMonths(c, 12), 15),
      cleChamp: "acpt_is_4",
    })
  }

  // Solde IS + Liasse 2065 : 3 mois + 15j après clôture
  echeances.push({
    libelle: "Solde IS + Liasse fiscale 2065",
    type: "FISCALE",
    dateEcheance: addDays(addMonths(c, 3), 15),
    cleChamp: "solde_is",
  })

  // Acompte IS N+1 (1er acompte exercice suivant) : 15 mois + 15j
  echeances.push({
    libelle: "Acompte IS N+1",
    type: "FISCALE",
    dateEcheance: addDays(addMonths(c, 15), 15),
    cleChamp: "acpt_is_n1",
  })

  return echeances
}

// ──────────────────────────────────────────────
// Juridique — AG et dépôt comptes
// ──────────────────────────────────────────────

export function calculerEcheancesJuridiques(
  dossier: Dossier
): EcheanceCalculee[] {
  if (!dossier.dateClotureExercice) return []

  const c = new Date(dossier.dateClotureExercice)
  const echeances: EcheanceCalculee[] = []

  // AGO : dans les 6 mois suivant la clôture
  echeances.push({
    libelle: "AGO — Approbation des comptes",
    type: "JURIDIQUE",
    dateEcheance: addMonths(c, 6),
    cleChamp: "statut_ago",
  })

  // Dépôt greffe : 1 mois après l'AGO (7 mois après clôture)
  echeances.push({
    libelle: "Dépôt comptes au greffe du tribunal",
    type: "JURIDIQUE",
    dateEcheance: addMonths(c, 7),
  })

  // DAS 2 : 15 mai N+1
  if (dossier.statutDas2 !== null) {
    echeances.push({
      libelle: "DAS 2 — Déclaration honoraires/commissions",
      type: "FISCALE",
      dateEcheance: new Date(c.getFullYear() + 1, 4, 15),
      cleChamp: "statut_das2",
    })
  }

  return echeances
}

// ──────────────────────────────────────────────
// CVAE
// ──────────────────────────────────────────────

export function calculerEcheancesCVAE(
  dossier: Dossier,
  annee: number
): EcheanceCalculee[] {
  // CVAE applicable si le dossier a un suivi CVAE actif
  if (dossier.suiviCvae === "-" || dossier.suiviCvae === "non") return []
  if (!dossier.suiviCvae && !dossier.acompteCvae06 && !dossier.soldeCvae) return []

  return [
    {
      libelle: `Acompte CVAE 06/${annee}`,
      type: "FISCALE",
      dateEcheance: new Date(annee, 5, 15), // 15 juin
      cleChamp: "acompte_cvae_06",
    },
    {
      libelle: `Acompte CVAE 09/${annee}`,
      type: "FISCALE",
      dateEcheance: new Date(annee, 8, 15), // 15 septembre
      cleChamp: "acompte_cvae_09",
    },
    {
      libelle: `Solde CVAE + 1330-CVAE ${annee}`,
      type: "FISCALE",
      // 2ème jour ouvré de mai — approximé au 3 mai
      dateEcheance: new Date(annee, 4, 3),
      cleChamp: "solde_cvae",
    },
  ]
}

// ──────────────────────────────────────────────
// CFE
// ──────────────────────────────────────────────

export function calculerEcheancesCFE(
  dossier: Dossier,
  annee: number
): EcheanceCalculee[] {
  // Si CFE géré par prélèvement automatique, pas d'échéance manuelle
  if (dossier.suiviCfe === "PE" || dossier.suiviCfe === "PM") return []
  if (dossier.suiviCfe === "-") return []

  const echeances: EcheanceCalculee[] = [
    {
      libelle: `Solde CFE ${annee}`,
      type: "FISCALE",
      dateEcheance: new Date(annee, 11, 15), // 15 décembre
      cleChamp: "suivi_cfe",
    },
  ]

  // Acompte CFE (si CFE > 3000€) : 15 juin
  echeances.push({
    libelle: `Acompte CFE ${annee}`,
    type: "FISCALE",
    dateEcheance: new Date(annee, 5, 15),
  })

  return echeances
}

// ──────────────────────────────────────────────
// Génération complète pour un dossier
// ──────────────────────────────────────────────

export function genererToutesEcheances(
  dossier: Dossier,
  annee: number
): EcheanceCalculee[] {
  return [
    ...calculerEcheancesTVA(dossier, annee),
    ...calculerEcheancesIS(dossier),
    ...calculerEcheancesJuridiques(dossier),
    ...calculerEcheancesCVAE(dossier, annee),
    ...calculerEcheancesCFE(dossier, annee),
  ]
}
