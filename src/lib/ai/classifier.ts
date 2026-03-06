/**
 * Classification IA des emails entrants.
 * Prompt chargé depuis /prompts/classification_email.md
 */

import { callClaude } from "./client"
import { loadPrompt } from "./prompts"
import { prisma } from "@/lib/db/prisma"

export type CategorieEmail =
  | "DOCUMENTS_MANQUANTS"
  | "QUESTION_FISCALE"
  | "URGENCE_ECHEANCE"
  | "AUTRE"

export interface ClassificationResult {
  categorie: CategorieEmail
  dossier_id_suggere: string | null
  confiance: number
  resume_court: string
}

/**
 * Classifie un email et tente de le rattacher à un dossier.
 */
export async function classifyEmail(
  tenantId: string,
  expediteurEmail: string,
  sujet: string,
  corps: string
): Promise<ClassificationResult | null> {
  const systemPrompt = loadPrompt("classification_email.md")

  // Charger les dossiers du tenant pour le matching (incluant adresses email multiples)
  const dossiers = await prisma.dossier.findMany({
    where: { tenantId },
    select: {
      id: true,
      raisonSociale: true,
      emailContact: true,
      siren: true,
      nomContact: true,
      adressesEmail: { select: { email: true } },
    },
  })

  const dossiersContext = dossiers.map((d) => ({
    id: d.id,
    raison_sociale: d.raisonSociale,
    email_contact: d.emailContact,
    emails: d.adressesEmail.map((e) => e.email),
    siren: d.siren,
    nom_contact: d.nomContact,
  }))

  const userContent = `## Dossiers du cabinet (pour le matching)
${JSON.stringify(dossiersContext, null, 2)}

## Email à classifier
Expéditeur : ${expediteurEmail}
Sujet : ${sujet}
Corps :
${corps.substring(0, 3000)}`

  const response = await callClaude(systemPrompt, userContent)
  if (!response) return null

  try {
    // Extraire le JSON de la réponse
    const jsonMatch = response.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return null

    const parsed = JSON.parse(jsonMatch[0]) as ClassificationResult

    // Valider la catégorie
    const validCategories: CategorieEmail[] = [
      "DOCUMENTS_MANQUANTS",
      "QUESTION_FISCALE",
      "URGENCE_ECHEANCE",
      "AUTRE",
    ]
    if (!validCategories.includes(parsed.categorie)) {
      parsed.categorie = "AUTRE"
    }

    // Valider la confiance
    if (typeof parsed.confiance !== "number" || parsed.confiance < 0 || parsed.confiance > 1) {
      parsed.confiance = 0.5
    }

    return parsed
  } catch {
    console.error("[Classifier] Failed to parse response:", response.substring(0, 200))
    return null
  }
}
