import { NextRequest, NextResponse } from "next/server"
import { getTenantId } from "@/lib/tenant"
import { prisma } from "@/lib/db/prisma"
import { callClaude } from "@/lib/ai/client"
import { readFileSync } from "fs"
import { join } from "path"

// Load the system prompt template
function loadPromptTemplate(): string {
  try {
    return readFileSync(
      join(process.cwd(), "prompts", "agent_dossier_travail.md"),
      "utf-8"
    )
  } catch {
    // Fallback inline prompt if file not found
    return `Tu es un expert-comptable. Analyse la balance CSV fournie et retourne un JSON structuré par cycle comptable.
Cycles : IMM (Immobilisations 20-28), STK (Stocks 31-39), CLI (Clients 41), FRS (Fournisseurs 40),
SOC (Social 42-43), FIS (Fiscal 44), TRE (Trésorerie 51-58), CAP (Capitaux 10-15),
CHA (Charges 60-68), PRO (Produits 70-78), DIV (Divers).
Retourne UNIQUEMENT du JSON valide avec : meta, cycles (code, nom, comptes, totaux, anomalies), synthese.`
  }
}

export async function POST(req: NextRequest) {
  try {
    const tenantId = await getTenantId()

    const body = await req.json()
    const { dossierId, csvContent, preparateur } = body as {
      dossierId: string
      csvContent: string
      preparateur: string
    }

    if (!dossierId || !csvContent) {
      return NextResponse.json(
        { error: "dossierId et csvContent sont requis" },
        { status: 400 }
      )
    }

    // Fetch dossier info (tenant-isolated)
    const dossier = await prisma.dossier.findFirst({
      where: { id: dossierId, tenantId },
      select: {
        raisonSociale: true,
        dateArreteBilan: true,
        dateClotureExercice: true,
      },
    })

    if (!dossier) {
      return NextResponse.json({ error: "Dossier non trouvé" }, { status: 404 })
    }

    const dateArrete = dossier.dateArreteBilan ?? dossier.dateClotureExercice
    const dateArreteFmt = dateArrete
      ? new Date(dateArrete).toLocaleDateString("fr-FR")
      : "Non renseignée"
    const today = new Date().toLocaleDateString("fr-FR")

    // Build system prompt from template
    const template = loadPromptTemplate()
    const systemPrompt = template
      .replace("{{NOM_CLIENT}}", dossier.raisonSociale)
      .replace("{{DATE_ARRETE}}", dateArreteFmt)
      .replace("{{PREPARATEUR}}", preparateur || "N/A")
      .replace("{{DATE_PREPARATION}}", today)

    // Call Claude with the CSV content
    const result = await callClaude(
      systemPrompt,
      `Voici la balance CSV à analyser :\n\n${csvContent}`,
      4096
    )

    if (!result) {
      return NextResponse.json(
        { error: "Erreur lors de l'analyse IA. Vérifiez votre clé ANTHROPIC_API_KEY." },
        { status: 500 }
      )
    }

    // Parse the JSON response from Claude
    let analysisData
    try {
      // Extract JSON from response (Claude may wrap in markdown code blocks)
      const jsonMatch = result.match(/```(?:json)?\s*([\s\S]*?)```/)
      const jsonStr = jsonMatch ? jsonMatch[1].trim() : result.trim()
      analysisData = JSON.parse(jsonStr)
    } catch {
      return NextResponse.json(
        { error: "L'IA n'a pas retourné un JSON valide", raw: result },
        { status: 500 }
      )
    }

    // Log the session (optional — TravauxSession model)
    try {
      await prisma.travauxSession.create({
        data: {
          tenantId,
          dossierId,
          outil: "DOSSIER_TRAVAIL",
          preparateur: preparateur || "N/A",
          statut: "TERMINE",
          resultat: analysisData,
        },
      })
    } catch {
      // Table might not exist yet — non-blocking
      console.warn("[agent/dossier] TravauxSession logging skipped (table may not exist)")
    }

    return NextResponse.json({ success: true, data: analysisData })
  } catch (err) {
    console.error("[agent/dossier] Error:", err)
    return NextResponse.json(
      { error: "Erreur interne du serveur" },
      { status: 500 }
    )
  }
}
