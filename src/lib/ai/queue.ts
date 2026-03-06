/**
 * File de traitement séquentiel des emails.
 * Respecte les rate limits Claude API : traitement un par un.
 *
 * Pour chaque email entrant :
 * 1. Classification IA
 * 2. Résumé IA
 * 3. Rattachement dossier (si confiance > 0.7)
 * 4. Création alerte si URGENCE_ECHEANCE
 * 5. Sauvegarde en table `emails`
 */

import { prisma } from "@/lib/db/prisma"
import { classifyEmail, type CategorieEmail } from "./classifier"
import { summarizeEmail } from "./summarizer"
import type { ParsedEmail } from "@/lib/graph/emails"

// Mapping catégorie → tag email Prisma
const CATEGORIE_TO_TAG: Record<CategorieEmail, "FISCAL" | "SOCIAL" | "JURIDIQUE" | "ADMIN" | "AUTRE"> = {
  DOCUMENTS_MANQUANTS: "ADMIN",
  QUESTION_FISCALE: "FISCAL",
  URGENCE_ECHEANCE: "FISCAL",
  AUTRE: "AUTRE",
}

// Mapping confiance numérique → enum Prisma
function confianceToEnum(confiance: number): "HAUTE" | "MOYENNE" | "FAIBLE" {
  if (confiance >= 0.8) return "HAUTE"
  if (confiance >= 0.5) return "MOYENNE"
  return "FAIBLE"
}

export interface ProcessResult {
  emailId: string
  microsoftMessageId: string
  categorie: CategorieEmail | null
  dossierId: string | null
  rattacheAuto: boolean
  alerteCreee: boolean
}

/**
 * Traite un seul email : classification + résumé + sauvegarde.
 */
export async function processEmail(
  tenantId: string,
  parsed: ParsedEmail
): Promise<ProcessResult> {
  // Vérifier si déjà traité (clé unique : microsoft_message_id)
  const existing = await prisma.email.findUnique({
    where: { microsoftMessageId: parsed.microsoftMessageId },
  })
  if (existing) {
    return {
      emailId: existing.id,
      microsoftMessageId: parsed.microsoftMessageId,
      categorie: null,
      dossierId: existing.dossierId,
      rattacheAuto: existing.rattacheAuto,
      alerteCreee: false,
    }
  }

  // 1. Classification IA
  const classification = await classifyEmail(
    tenantId,
    parsed.expediteurEmail,
    parsed.sujet,
    parsed.corpsTexte
  )

  // 2. Résumé IA
  const resume = await summarizeEmail(
    parsed.expediteur,
    parsed.sujet,
    parsed.corpsTexte
  )

  // 3. Rattachement dossier
  let dossierId: string | null = null
  let rattacheAuto = false

  if (classification?.dossier_id_suggere && classification.confiance > 0.7) {
    // Vérifier que le dossier existe et appartient au tenant
    const dossier = await prisma.dossier.findFirst({
      where: {
        id: classification.dossier_id_suggere,
        tenantId,
      },
    })
    if (dossier) {
      dossierId = dossier.id
      rattacheAuto = classification.confiance >= 0.8
    }
  }

  // 5. Sauvegarde en base
  const email = await prisma.email.create({
    data: {
      tenantId,
      microsoftMessageId: parsed.microsoftMessageId,
      expediteur: `${parsed.expediteur} <${parsed.expediteurEmail}>`,
      destinataires: parsed.destinataires,
      sujet: parsed.sujet,
      corpsTexte: parsed.corpsTexte,
      dateReception: parsed.dateReception,
      resumeIa: resume ?? classification?.resume_court ?? null,
      tagIa: classification ? CATEGORIE_TO_TAG[classification.categorie] : null,
      urgenceIa: classification?.categorie === "URGENCE_ECHEANCE" ? 5 : null,
      confianceMatchIa: classification ? confianceToEnum(classification.confiance) : null,
      dossierId,
      rattacheAuto,
      valide: rattacheAuto,
    },
  })

  // 4. Création alerte si URGENCE_ECHEANCE + rattaché à un dossier
  let alerteCreee = false
  if (classification?.categorie === "URGENCE_ECHEANCE" && dossierId) {
    const dossier = await prisma.dossier.findUnique({
      where: { id: dossierId },
      select: { collaborateurPrincipalId: true, raisonSociale: true },
    })

    if (dossier) {
      await prisma.alerte.create({
        data: {
          tenantId,
          dossierId,
          userId: dossier.collaborateurPrincipalId,
          titre: `Email urgent — ${parsed.sujet}`,
          message: resume ?? classification.resume_court ?? `Email urgent reçu pour ${dossier.raisonSociale}`,
          niveau: "URGENT",
          dateAlerte: new Date(),
        },
      })
      alerteCreee = true
    }
  }

  return {
    emailId: email.id,
    microsoftMessageId: parsed.microsoftMessageId,
    categorie: classification?.categorie ?? null,
    dossierId,
    rattacheAuto,
    alerteCreee,
  }
}

/**
 * Traite un lot d'emails séquentiellement.
 */
export async function processEmailBatch(
  tenantId: string,
  emails: ParsedEmail[]
): Promise<ProcessResult[]> {
  const results: ProcessResult[] = []

  for (const email of emails) {
    const result = await processEmail(tenantId, email)
    results.push(result)
  }

  return results
}
