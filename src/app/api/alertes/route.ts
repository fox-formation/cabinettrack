import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db/prisma"
import { getTenantId } from "@/lib/tenant"
import { genererAlertesEcheances } from "@/lib/alertes/scheduler"

export const dynamic = "force-dynamic"

// GET /api/alertes?tenantId=xxx&userId=xxx&nonLues=true
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const tenantId = searchParams.get("tenantId") || await getTenantId()

  const userId = searchParams.get("userId")
  const nonLues = searchParams.get("nonLues") === "true"

  const niveau = searchParams.get("niveau")
  const acquittee = searchParams.get("acquittee")
  const dossierId = searchParams.get("dossierId")

  const where: Record<string, unknown> = { tenantId }
  if (userId) where.userId = userId
  if (nonLues) where.lue = false
  if (niveau) where.niveau = niveau
  if (acquittee === "true") where.acquittee = true
  if (acquittee === "false") where.acquittee = false
  if (dossierId) where.dossierId = dossierId

  const alertes = await prisma.alerte.findMany({
    where,
    include: {
      dossier: { select: { id: true, raisonSociale: true } },
      echeance: { select: { id: true, libelle: true, dateEcheance: true } },
    },
    orderBy: { dateAlerte: "desc" },
    take: 100,
  })

  return NextResponse.json(alertes)
}

// POST /api/alertes/run — Lancer la génération d'alertes (cron endpoint)
export async function POST(req: NextRequest) {
  const body = await req.json()
  const { tenantId } = body

  if (!tenantId) {
    return NextResponse.json({ error: "tenantId is required" }, { status: 400 })
  }

  const result = await genererAlertesEcheances(tenantId)

  return NextResponse.json({
    message: `Alertes: ${result.created} créées, ${result.escalated} escaladées`,
    ...result,
  })
}

// PATCH /api/alertes — Marquer des alertes comme lues/acquittées
export async function PATCH(req: NextRequest) {
  const body = await req.json()
  const { ids, lue, acquittee } = body

  if (!ids || !Array.isArray(ids)) {
    return NextResponse.json({ error: "ids array is required" }, { status: 400 })
  }

  const data: Record<string, boolean> = {}
  if (typeof lue === "boolean") data.lue = lue
  if (typeof acquittee === "boolean") data.acquittee = acquittee

  await prisma.alerte.updateMany({
    where: { id: { in: ids } },
    data,
  })

  return NextResponse.json({ success: true, updated: ids.length })
}
