/**
 * Calcul de l'avancement d'un dossier (0-100%).
 * Basé sur 14 étapes pondérées. Les étapes hasNote (poids 0)
 * ne comptent pas dans le % mais bloquent visuellement.
 * Chaque étape supporte 4 niveaux : QUART(25%), DEMI(50%), EN_COURS(75%), EFFECTUE(100%).
 */

import type { Dossier } from "@prisma/client"

export interface EtapeDefinition {
  cle: keyof Dossier
  label: string
  poids: number
  hasNote: boolean
  noteField?: keyof Dossier
}

export const ETAPES_BILAN: EtapeDefinition[] = [
  { cle: "statutCourantSaisie",    label: "Courant saisie",         poids: 50, hasNote: false },
  { cle: "statutManquantSaisie",   label: "Manquant pour saisie",   poids: 0,  hasNote: true, noteField: "noteManquantSaisie" },
  { cle: "statutRevisionFaite",    label: "Révision faite",         poids: 10, hasNote: false },
  { cle: "statutOdInventaire",     label: "OD inventaire saisie",   poids: 15, hasNote: false },
  { cle: "statutManquantRevision", label: "Manquant pour révision", poids: 0,  hasNote: true, noteField: "noteManquantRevision" },
  { cle: "statutEtatsFinanciers",  label: "États financiers",       poids: 4,  hasNote: false },
  { cle: "statutLiasseFiscale",    label: "Liasse fiscale faite",   poids: 10, hasNote: false },
  { cle: "statutSignatureAssocie", label: "Signature associé",      poids: 1,  hasNote: false },
  { cle: "statutEnvoiClient",     label: "Envoi au client",        poids: 5,  hasNote: false },
  { cle: "statutTeledeclaration",  label: "Télédéclaration",        poids: 1,  hasNote: false },
  { cle: "statut2572",             label: "2572",                   poids: 1,  hasNote: false },
  { cle: "statutDas2",             label: "DAS 2",                  poids: 1,  hasNote: false },
  { cle: "statutVerifEnvoi",      label: "Vérif envoi",            poids: 1,  hasNote: false },
  { cle: "statutAgo",              label: "AGO",                    poids: 1,  hasNote: false },
]

const STATUT_RATIO: Record<string, number> = {
  QUART: 0.25,
  DEMI: 0.5,
  EN_COURS: 0.75,
  EFFECTUE: 1,
}

export function calculerAvancement(dossier: Dossier): number {
  return ETAPES_BILAN.reduce((total, etape) => {
    if (etape.poids === 0) return total
    const val = dossier[etape.cle] as string | null
    if (!val) return total
    const ratio = STATUT_RATIO[val] ?? 0
    return total + etape.poids * ratio
  }, 0)
}

export type StatutLevel = "effectue" | "en_cours" | "demi" | "quart" | "non_demarre"

export interface EtapeAvancement {
  cle: string
  label: string
  poids: number
  statut: StatutLevel
  rawValue: string | null
  hasNote: boolean
  noteField?: string
  noteValue?: string | null
}

function toStatutLevel(val: string | null): StatutLevel {
  if (val === "EFFECTUE") return "effectue"
  if (val === "EN_COURS") return "en_cours"
  if (val === "DEMI") return "demi"
  if (val === "QUART") return "quart"
  return "non_demarre"
}

export function detailAvancement(dossier: Dossier): EtapeAvancement[] {
  return ETAPES_BILAN.map((etape) => {
    const val = dossier[etape.cle] as string | null

    return {
      cle: etape.cle as string,
      label: etape.label,
      poids: etape.poids,
      statut: toStatutLevel(val),
      rawValue: val as string | null,
      hasNote: etape.hasNote,
      noteField: etape.noteField as string | undefined,
      noteValue: etape.noteField ? (dossier[etape.noteField] as string | null) : undefined,
    }
  })
}
