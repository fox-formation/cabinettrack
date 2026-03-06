import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db/prisma"
import { toCSV } from "@/lib/exports/csv"
import { getTenantId } from "@/lib/tenant"

export const dynamic = "force-dynamic"

// GET /api/exports/echeances?mois=3&annee=2026
export async function GET(req: NextRequest) {
  let tenantId: string
  try {
    tenantId = await getTenantId()
  } catch {
    return NextResponse.json({ error: "Aucun tenant" }, { status: 400 })
  }

  const mois = req.nextUrl.searchParams.get("mois")
  const annee = req.nextUrl.searchParams.get("annee")

  const where: Record<string, unknown> = { tenantId }

  if (mois && annee) {
    const debut = new Date(parseInt(annee), parseInt(mois) - 1, 1)
    const fin = new Date(parseInt(annee), parseInt(mois), 0) // dernier jour du mois
    where.dateEcheance = { gte: debut, lte: fin }
  } else if (annee) {
    const debut = new Date(parseInt(annee), 0, 1)
    const fin = new Date(parseInt(annee), 11, 31)
    where.dateEcheance = { gte: debut, lte: fin }
  }

  const echeances = await prisma.echeance.findMany({
    where,
    include: {
      dossier: { select: { raisonSociale: true } },
    },
    orderBy: { dateEcheance: "asc" },
  })

  const headers = [
    "Dossier", "Libellé", "Type", "Date échéance", "Statut", "Commentaire",
  ]

  const rows = echeances.map((e) => [
    e.dossier.raisonSociale,
    e.libelle,
    e.type,
    new Date(e.dateEcheance).toLocaleDateString("fr-FR"),
    e.statut,
    e.commentaire,
  ])

  const csv = "\uFEFF" + toCSV(headers, rows)

  const filename = mois && annee
    ? `echeances_${annee}-${mois.padStart(2, "0")}.csv`
    : `echeances_${annee ?? "all"}.csv`

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  })
}
