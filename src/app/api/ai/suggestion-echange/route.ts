import { NextRequest, NextResponse } from "next/server"
import { callClaude } from "@/lib/ai/client"
import { loadPrompt } from "@/lib/ai/prompts"

export const dynamic = "force-dynamic"

/**
 * POST /api/ai/suggestion-echange
 * Body: { resume, sujet?, sens?, raisonSociale? }
 * Returns: { suggestion: string } or { suggestion: null }
 */
export async function POST(req: NextRequest) {
  const body = await req.json()
  const { resume, sujet, sens, raisonSociale } = body

  if (!resume || resume.trim().length < 5) {
    return NextResponse.json({ suggestion: null })
  }

  const systemPrompt = loadPrompt("suggestion_echange.md")

  const parts: string[] = []
  if (raisonSociale) parts.push(`Client : ${raisonSociale}`)
  if (sens) parts.push(`Sens : ${sens === "ENTRANT" ? "Le client nous a contacté" : "Nous avons contacté le client"}`)
  if (sujet) parts.push(`Sujet : ${sujet}`)
  parts.push(`Résumé de l'échange : ${resume}`)

  const userContent = parts.join("\n")

  const suggestion = await callClaude(systemPrompt, userContent, 300)

  return NextResponse.json({ suggestion })
}
