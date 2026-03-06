import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db/prisma"
import { syncEcheancesEnBase } from "@/lib/alertes/scheduler"

export const dynamic = "force-dynamic"

// GET /api/echeances?tenantId=xxx&dossierId=xxx&from=xxx&to=xxx&type=xxx
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const tenantId = searchParams.get("tenantId")

  if (!tenantId) {
    return NextResponse.json({ error: "tenantId is required" }, { status: 400 })
  }

  const dossierId = searchParams.get("dossierId")
  const type = searchParams.get("type")
  const from = searchParams.get("from")
  const to = searchParams.get("to")
  const statut = searchParams.get("statut")

  const where: Record<string, unknown> = { tenantId }
  if (dossierId) where.dossierId = dossierId
  if (type) where.type = type
  if (statut) where.statut = statut
  if (from || to) {
    where.dateEcheance = {
      ...(from ? { gte: new Date(from) } : {}),
      ...(to ? { lte: new Date(to) } : {}),
    }
  }

  const echeances = await prisma.echeance.findMany({
    where,
    include: {
      dossier: {
        select: {
          id: true,
          raisonSociale: true,
          collaborateurPrincipalId: true,
          collaborateurPrincipal: { select: { prenom: true } },
          cabinet: { select: { nom: true } },
        },
      },
    },
    orderBy: { dateEcheance: "asc" },
  })

  return NextResponse.json(echeances)
}

// POST /api/echeances/generate — Génère les échéances pour un tenant et une année
export async function POST(req: NextRequest) {
  const body = await req.json()
  const { tenantId, annee } = body

  if (!tenantId || !annee) {
    return NextResponse.json(
      { error: "tenantId and annee are required" },
      { status: 400 }
    )
  }

  const result = await syncEcheancesEnBase(tenantId, annee)

  return NextResponse.json({
    message: `Échéances générées: ${result.created} créées, ${result.skipped} existantes`,
    ...result,
  })
}
