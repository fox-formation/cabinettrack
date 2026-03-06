import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db/prisma"
import { getTenantId } from "@/lib/tenant"

export const dynamic = "force-dynamic"

/**
 * GET /api/agenda?mois=2026-03&userId=xxx&cabinetId=xxx
 *
 * Retourne les échéances du mois demandé, groupées par jour,
 * avec les infos du dossier et du collaborateur.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const tenantId = searchParams.get("tenantId") || await getTenantId()

  // Période : mois complet (format YYYY-MM) ou plage from/to
  const mois = searchParams.get("mois")
  const from = searchParams.get("from")
  const to = searchParams.get("to")
  const userId = searchParams.get("userId")
  const cabinetId = searchParams.get("cabinetId")

  let dateFrom: Date
  let dateTo: Date

  if (mois) {
    const [y, m] = mois.split("-").map(Number)
    dateFrom = new Date(y, m - 1, 1)
    dateTo = new Date(y, m, 0) // Dernier jour du mois
  } else if (from && to) {
    dateFrom = new Date(from)
    dateTo = new Date(to)
  } else {
    // Mois en cours par défaut
    const now = new Date()
    dateFrom = new Date(now.getFullYear(), now.getMonth(), 1)
    dateTo = new Date(now.getFullYear(), now.getMonth() + 1, 0)
  }

  const where: Record<string, unknown> = {
    tenantId,
    dateEcheance: { gte: dateFrom, lte: dateTo },
  }

  // Filtrer par collaborateur (via le dossier)
  if (userId || cabinetId) {
    const dossierWhere: Record<string, unknown> = {}
    if (userId) dossierWhere.collaborateurPrincipalId = userId
    if (cabinetId) dossierWhere.cabinetId = cabinetId
    where.dossier = dossierWhere
  }

  const echeances = await prisma.echeance.findMany({
    where,
    include: {
      dossier: {
        select: {
          id: true,
          raisonSociale: true,
          collaborateurPrincipalId: true,
          collaborateurPrincipal: { select: { id: true, prenom: true } },
          cabinet: { select: { id: true, nom: true } },
          regimeTva: true,
          regimeFiscal: true,
        },
      },
    },
    orderBy: { dateEcheance: "asc" },
  })

  // Grouper par jour
  const parJour: Record<string, typeof echeances> = {}
  for (const ech of echeances) {
    const jour = new Date(ech.dateEcheance).toISOString().split("T")[0]
    if (!parJour[jour]) parJour[jour] = []
    parJour[jour].push(ech)
  }

  // Stats rapides
  const stats = {
    total: echeances.length,
    aFaire: echeances.filter((e) => e.statut === "A_FAIRE").length,
    enCours: echeances.filter((e) => e.statut === "EN_COURS").length,
    fait: echeances.filter((e) => e.statut === "FAIT").length,
  }

  return NextResponse.json({
    periode: {
      from: dateFrom.toISOString().split("T")[0],
      to: dateTo.toISOString().split("T")[0],
    },
    stats,
    parJour,
    echeances,
  })
}
