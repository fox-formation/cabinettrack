import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db/prisma"
import { getTenantId } from "@/lib/tenant"
import { callClaude } from "@/lib/ai/client"
import { loadPrompt } from "@/lib/ai/prompts"

export const dynamic = "force-dynamic"

// ──────────────────────────────────────────────
// FEC Parser — Extraction des KPIs comptables
// ──────────────────────────────────────────────

interface FecKpis {
  nbLignes: number
  chiffreAffaires: number
  totalCharges: number
  totalProduits: number
  resultat: number
  resultatExploitation: number
  margeExploitation: number | null
  montantIS: number
  lignesParJournal: Record<string, number>
}

function detectSeparator(firstLine: string): string {
  if (firstLine.includes("\t")) return "\t"
  if (firstLine.includes("|")) return "|"
  if (firstLine.includes(";")) return ";"
  return "\t"
}

function detectEncoding(buffer: Buffer): string {
  // Simple BOM detection
  if (buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf) return "utf-8"
  if (buffer[0] === 0xff && buffer[1] === 0xfe) return "utf-16le"
  // Try to detect ISO-8859-1 vs UTF-8
  // If there are bytes > 127 that aren't valid UTF-8 sequences, assume ISO-8859-1
  for (let i = 0; i < Math.min(buffer.length, 1000); i++) {
    if (buffer[i] > 127) {
      try {
        new TextDecoder("utf-8", { fatal: true }).decode(buffer.slice(i, i + 4))
      } catch {
        return "iso-8859-1"
      }
    }
  }
  return "utf-8"
}

function parseFec(content: string): FecKpis {
  const lines = content.split(/\r?\n/).filter((l) => l.trim())
  if (lines.length < 2) {
    return { nbLignes: 0, chiffreAffaires: 0, totalCharges: 0, totalProduits: 0, resultat: 0, resultatExploitation: 0, margeExploitation: null, montantIS: 0, lignesParJournal: {} }
  }

  const separator = detectSeparator(lines[0])
  const headers = lines[0].split(separator).map((h) => h.trim().replace(/^"|"$/g, "").toLowerCase())

  // Find column indices (FEC standard columns)
  const compteIdx = headers.findIndex((h) =>
    ["comptenum", "compte_num", "compte", "numero_compte", "numcompte"].includes(h)
  )
  const debitIdx = headers.findIndex((h) => ["debit", "montantdebit", "montant_debit"].includes(h))
  const creditIdx = headers.findIndex((h) => ["credit", "montantcredit", "montant_credit"].includes(h))
  const journalIdx = headers.findIndex((h) =>
    ["journalcode", "journal_code", "journal", "code_journal", "codejournal"].includes(h)
  )

  if (compteIdx === -1 || debitIdx === -1 || creditIdx === -1) {
    throw new Error(
      `Colonnes FEC introuvables. Colonnes détectées : ${headers.join(", ")}. ` +
      `Attendu : CompteNum, Debit, Credit.`
    )
  }

  let totalDebitClasse6 = 0
  let totalCreditClasse6 = 0
  let totalDebitClasse7 = 0
  let totalCreditClasse7 = 0
  // Exploitation : comptes 60-65 (charges) et 70-75 (produits)
  let debitChargesExploit = 0
  let creditChargesExploit = 0
  let debitProduitsExploit = 0
  let creditProduitsExploit = 0
  let debitCompte695 = 0
  let nbLignes = 0
  const lignesParJournal: Record<string, number> = {}

  const parseAmount = (val: string): number => {
    if (!val) return 0
    const cleaned = val.trim().replace(/^"|"$/g, "").replace(/\s/g, "").replace(",", ".")
    const n = parseFloat(cleaned)
    return isNaN(n) ? 0 : n
  }

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(separator)
    if (cols.length <= Math.max(compteIdx, debitIdx, creditIdx)) continue

    const compte = cols[compteIdx].trim().replace(/^"|"$/g, "")
    const debit = parseAmount(cols[debitIdx])
    const credit = parseAmount(cols[creditIdx])

    nbLignes++

    // Count per journal
    if (journalIdx !== -1 && cols[journalIdx]) {
      const journal = cols[journalIdx].trim().replace(/^"|"$/g, "").toUpperCase()
      if (journal) {
        lignesParJournal[journal] = (lignesParJournal[journal] || 0) + 1
      }
    }

    const classe = compte.charAt(0)
    const prefix2 = compte.substring(0, 2)

    // Classe 6 = Charges
    if (classe === "6") {
      totalDebitClasse6 += debit
      totalCreditClasse6 += credit
      // Charges d'exploitation : 60-65
      const n2 = parseInt(prefix2, 10)
      if (n2 >= 60 && n2 <= 65) {
        debitChargesExploit += debit
        creditChargesExploit += credit
      }
    }

    // Classe 7 = Produits
    if (classe === "7") {
      totalDebitClasse7 += debit
      totalCreditClasse7 += credit
      // Produits d'exploitation : 70-75
      const n2 = parseInt(prefix2, 10)
      if (n2 >= 70 && n2 <= 75) {
        debitProduitsExploit += debit
        creditProduitsExploit += credit
      }
    }

    // Compte 695* = Impôt sur les sociétés
    if (compte.startsWith("695")) {
      debitCompte695 += debit
    }
  }

  const totalProduits = totalCreditClasse7 - totalDebitClasse7
  const totalCharges = totalDebitClasse6 - totalCreditClasse6
  const resultat = totalProduits - totalCharges
  const chiffreAffaires = totalProduits

  // Résultat d'exploitation = Produits exploit (70-75) - Charges exploit (60-65)
  const produitsExploit = creditProduitsExploit - debitProduitsExploit
  const chargesExploit = debitChargesExploit - creditChargesExploit
  const resultatExploitation = produitsExploit - chargesExploit
  // Marge d'exploitation = Résultat exploit / CA × 100
  const margeExploitation = chiffreAffaires !== 0
    ? (resultatExploitation / chiffreAffaires) * 100
    : null

  return {
    nbLignes,
    chiffreAffaires: Math.round(chiffreAffaires * 100) / 100,
    totalCharges: Math.round(totalCharges * 100) / 100,
    totalProduits: Math.round(totalProduits * 100) / 100,
    resultat: Math.round(resultat * 100) / 100,
    resultatExploitation: Math.round(resultatExploitation * 100) / 100,
    margeExploitation: margeExploitation !== null ? Math.round(margeExploitation * 100) / 100 : null,
    montantIS: Math.round(debitCompte695 * 100) / 100,
    lignesParJournal,
  }
}

// ──────────────────────────────────────────────
// GET /api/fec?dossierId=xxx
// ──────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const tenantId = await getTenantId()
  if (!tenantId) return NextResponse.json({ error: "Non autorisé" }, { status: 401 })

  const dossierId = req.nextUrl.searchParams.get("dossierId")
  if (!dossierId) return NextResponse.json({ error: "dossierId requis" }, { status: 400 })

  const imports = await prisma.fecImport.findMany({
    where: { tenantId, dossierId },
    orderBy: { exercice: "desc" },
  })

  return NextResponse.json(imports)
}

// ──────────────────────────────────────────────
// POST /api/fec — Upload et parsing d'un FEC
// Body: FormData avec file, dossierId, exercice
// ──────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const tenantId = await getTenantId()
  if (!tenantId) return NextResponse.json({ error: "Non autorisé" }, { status: 401 })

  const formData = await req.formData()
  const file = formData.get("file") as File | null
  const dossierId = formData.get("dossierId") as string | null
  const exerciceStr = formData.get("exercice") as string | null

  if (!file || !dossierId || !exerciceStr) {
    return NextResponse.json({ error: "file, dossierId et exercice requis" }, { status: 400 })
  }

  const exercice = parseInt(exerciceStr, 10)
  if (isNaN(exercice) || exercice < 2000 || exercice > 2100) {
    return NextResponse.json({ error: "Exercice invalide" }, { status: 400 })
  }

  // Verify dossier belongs to tenant
  const dossier = await prisma.dossier.findFirst({
    where: { id: dossierId, tenantId },
    select: { id: true, raisonSociale: true, regimeFiscal: true, formeJuridique: true },
  })
  if (!dossier) return NextResponse.json({ error: "Dossier introuvable" }, { status: 404 })

  try {
    // Read and decode file
    const buffer = Buffer.from(await file.arrayBuffer())
    const encoding = detectEncoding(buffer)
    const content = new TextDecoder(encoding).decode(buffer)

    // Parse FEC
    const kpis = parseFec(content)

    if (kpis.nbLignes === 0) {
      return NextResponse.json({ error: "Fichier FEC vide ou format non reconnu" }, { status: 400 })
    }

    // Get existing N-1 data for AI comparison
    const existingOther = await prisma.fecImport.findFirst({
      where: { tenantId, dossierId, exercice: { not: exercice } },
      orderBy: { exercice: "desc" },
    })

    // Generate AI suggestions
    let suggestionsIA: string | null = null
    try {
      const systemPrompt = loadPrompt("analyse_fec.md")
      const parts: string[] = [
        `Dossier : ${dossier.raisonSociale}`,
        `Forme juridique : ${dossier.formeJuridique ?? "Non renseignée"}`,
        `Régime fiscal : ${dossier.regimeFiscal ?? "Non renseigné"}`,
        ``,
        `=== Exercice ${exercice} (N) ===`,
        `Chiffre d'affaires : ${kpis.chiffreAffaires.toLocaleString("fr-FR")} €`,
        `Total charges : ${kpis.totalCharges.toLocaleString("fr-FR")} €`,
        `Total produits : ${kpis.totalProduits.toLocaleString("fr-FR")} €`,
        `Résultat net : ${kpis.resultat.toLocaleString("fr-FR")} €`,
        `Résultat d'exploitation : ${kpis.resultatExploitation.toLocaleString("fr-FR")} €`,
        `Marge d'exploitation : ${kpis.margeExploitation !== null ? kpis.margeExploitation.toFixed(1) + " %" : "N/A"}`,
        `Montant IS : ${kpis.montantIS.toLocaleString("fr-FR")} €`,
        `Nombre de lignes : ${kpis.nbLignes}`,
      ]

      if (existingOther) {
        parts.push(
          ``,
          `=== Exercice ${existingOther.exercice} (N-1) ===`,
          `Chiffre d'affaires : ${existingOther.chiffreAffaires?.toLocaleString("fr-FR") ?? "?"} €`,
          `Total charges : ${existingOther.totalCharges?.toLocaleString("fr-FR") ?? "?"} €`,
          `Total produits : ${existingOther.totalProduits?.toLocaleString("fr-FR") ?? "?"} €`,
          `Résultat net : ${existingOther.resultat?.toLocaleString("fr-FR") ?? "?"} €`,
          `Résultat d'exploitation : ${existingOther.resultatExploitation?.toLocaleString("fr-FR") ?? "?"} €`,
          `Marge d'exploitation : ${existingOther.margeExploitation != null ? existingOther.margeExploitation.toFixed(1) + " %" : "N/A"}`,
          `Montant IS : ${existingOther.montantIS?.toLocaleString("fr-FR") ?? "?"} €`,
          `Nombre de lignes : ${existingOther.nbLignes}`,
        )
      }

      suggestionsIA = await callClaude(systemPrompt, parts.join("\n"), 500)
    } catch {
      // IA non bloquante
    }

    // Upsert (replace if same exercice exists)
    const fecImport = await prisma.fecImport.upsert({
      where: {
        tenantId_dossierId_exercice: { tenantId, dossierId, exercice },
      },
      update: {
        nomFichier: file.name,
        nbLignes: kpis.nbLignes,
        chiffreAffaires: kpis.chiffreAffaires,
        resultat: kpis.resultat,
        resultatExploitation: kpis.resultatExploitation,
        margeExploitation: kpis.margeExploitation,
        montantIS: kpis.montantIS,
        totalCharges: kpis.totalCharges,
        totalProduits: kpis.totalProduits,
        lignesParJournal: kpis.lignesParJournal,
        suggestionsIA,
      },
      create: {
        tenantId,
        dossierId,
        exercice,
        nomFichier: file.name,
        nbLignes: kpis.nbLignes,
        chiffreAffaires: kpis.chiffreAffaires,
        resultat: kpis.resultat,
        resultatExploitation: kpis.resultatExploitation,
        margeExploitation: kpis.margeExploitation,
        montantIS: kpis.montantIS,
        totalCharges: kpis.totalCharges,
        totalProduits: kpis.totalProduits,
        lignesParJournal: kpis.lignesParJournal,
        suggestionsIA,
      },
    })

    // If we now have both N and N-1, regenerate suggestions for the other one too
    if (existingOther && !existingOther.suggestionsIA) {
      try {
        const systemPrompt = loadPrompt("analyse_fec.md")
        const parts = [
          `Dossier : ${dossier.raisonSociale}`,
          `Forme juridique : ${dossier.formeJuridique ?? "Non renseignée"}`,
          `Régime fiscal : ${dossier.regimeFiscal ?? "Non renseigné"}`,
          ``,
          `=== Exercice ${existingOther.exercice} (N) ===`,
          `Chiffre d'affaires : ${existingOther.chiffreAffaires?.toLocaleString("fr-FR") ?? "?"} €`,
          `Résultat : ${existingOther.resultat?.toLocaleString("fr-FR") ?? "?"} €`,
          `Montant IS : ${existingOther.montantIS?.toLocaleString("fr-FR") ?? "?"} €`,
          ``,
          `=== Exercice ${exercice} (N-1 de référence) ===`,
          `Chiffre d'affaires : ${kpis.chiffreAffaires.toLocaleString("fr-FR")} €`,
          `Résultat : ${kpis.resultat.toLocaleString("fr-FR")} €`,
          `Montant IS : ${kpis.montantIS.toLocaleString("fr-FR")} €`,
        ]
        const otherSuggestions = await callClaude(systemPrompt, parts.join("\n"), 500)
        if (otherSuggestions) {
          await prisma.fecImport.update({
            where: { id: existingOther.id },
            data: { suggestionsIA: otherSuggestions },
          })
        }
      } catch {
        // non bloquant
      }
    }

    return NextResponse.json(fecImport)
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erreur de parsing FEC"
    return NextResponse.json({ error: message }, { status: 400 })
  }
}

// ──────────────────────────────────────────────
// DELETE /api/fec?id=xxx
// ──────────────────────────────────────────────

export async function DELETE(req: NextRequest) {
  const tenantId = await getTenantId()
  if (!tenantId) return NextResponse.json({ error: "Non autorisé" }, { status: 401 })

  const id = req.nextUrl.searchParams.get("id")
  if (!id) return NextResponse.json({ error: "id requis" }, { status: 400 })

  await prisma.fecImport.deleteMany({
    where: { id, tenantId },
  })

  return NextResponse.json({ ok: true })
}
