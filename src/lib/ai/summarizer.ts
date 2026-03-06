/**
 * Résumé IA des emails.
 * Prompt chargé depuis /prompts/resume_email.md
 */

import { callClaude } from "./client"
import { loadPrompt } from "./prompts"

/**
 * Génère un résumé professionnel de 2-3 lignes pour un email.
 */
export async function summarizeEmail(
  expediteur: string,
  sujet: string,
  corps: string
): Promise<string | null> {
  const systemPrompt = loadPrompt("resume_email.md")

  const userContent = `Expéditeur : ${expediteur}
Sujet : ${sujet}
Corps :
${corps.substring(0, 3000)}`

  const response = await callClaude(systemPrompt, userContent, 500)
  if (!response) return null

  // Le résumé est retourné en texte brut (pas de JSON)
  return response.trim()
}
