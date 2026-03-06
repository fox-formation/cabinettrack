import { NextResponse } from "next/server"
import { prisma } from "@/lib/db/prisma"
import { toCSV } from "@/lib/exports/csv"
import { calculerAvancement } from "@/lib/dossiers/avancement"
import { getTenantId } from "@/lib/tenant"

export const dynamic = "force-dynamic"

// GET /api/exports/avancement
export async function GET() {
  let tenantId: string
  try {
    tenantId = await getTenantId()
  } catch {
    return NextResponse.json({ error: "Aucun tenant" }, { status: 400 })
  }

  const dossiers = await prisma.dossier.findMany({
    where: { tenantId },
    include: {
      collaborateurPrincipal: { select: { prenom: true } },
    },
  })

  // Agréger par collaborateur
  const collabMap = new Map<string, {
    prenom: string
    total: number
    termines: number
    enCours: number
    nonDemarres: number
    retards: number
    sumAvancement: number
  }>()

  const now = new Date()

  for (const d of dossiers) {
    const prenom = d.collaborateurPrincipal?.prenom ?? "Non affecté"
    if (!collabMap.has(prenom)) {
      collabMap.set(prenom, { prenom, total: 0, termines: 0, enCours: 0, nonDemarres: 0, retards: 0, sumAvancement: 0 })
    }
    const c = collabMap.get(prenom)!
    const av = calculerAvancement(d)
    c.total++
    c.sumAvancement += av
    if (av >= 100) c.termines++
    else if (av > 0) c.enCours++
    else c.nonDemarres++
    if (d.datePrevueArreteBilan && new Date(d.datePrevueArreteBilan) < now && d.dateArreteBilan === null) {
      c.retards++
    }
  }

  const headers = [
    "Collaborateur", "Nb dossiers", "Terminés", "En cours", "Non démarrés", "Retards", "Avancement moyen (%)",
  ]

  const rows = Array.from(collabMap.values())
    .sort((a, b) => b.total - a.total)
    .map((c) => [
      c.prenom,
      c.total,
      c.termines,
      c.enCours,
      c.nonDemarres,
      c.retards,
      c.total > 0 ? Math.round(c.sumAvancement / c.total) : 0,
    ])

  const csv = "\uFEFF" + toCSV(headers, rows)

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="avancement_${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  })
}
