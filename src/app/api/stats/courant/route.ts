import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db/prisma"
import { getTenantId } from "@/lib/tenant"

export const dynamic = "force-dynamic"

const TACHES = [
  { key: "saisieAchat", label: "SACH" },
  { key: "saisieVente", label: "SVTE" },
  { key: "paieSaisie", label: "SPAI" },
  { key: "lettrage", label: "LACH" },
  { key: "lettrageVente", label: "LVTE" },
  { key: "paieRevision", label: "LPAI" },
  { key: "compteAttenteOk", label: "471OK" },
] as const

const NB_TACHES = TACHES.length

// ── Helpers ──────────────────────────────────────

function getClotureMois(dateClotureExercice: Date | null): number {
  if (!dateClotureExercice) return 11
  return dateClotureExercice.getUTCMonth()
}

function getM1Mois(clotureMois: number): number {
  return (clotureMois + 1) % 12
}

/** Returns the calendar {year,month(0-indexed)} for exercise month moisEx (1-indexed) */
function exerciseMonthToCalendar(
  moisEx: number,
  m1Mois: number,
  exerciseYear: number,
): { year: number; month: number } {
  const calMonth = (m1Mois + moisEx - 1) % 12
  const yearOffset = Math.floor((m1Mois + moisEx - 1) / 12)
  return { year: exerciseYear + yearOffset, month: calMonth }
}

function fmtPeriode(y: number, m: number): string {
  return `${y}-${String(m + 1).padStart(2, "0")}`
}

function countDone(suivi: Record<string, unknown>): number {
  return TACHES.reduce((n, t) => n + (suivi[t.key] === "EFFECTUE" ? 1 : 0), 0)
}

function countStarted(suivi: Record<string, unknown>): number {
  return TACHES.reduce((n, t) => {
    const v = suivi[t.key]
    return n + (v === "EFFECTUE" || v === "EN_COURS" ? 1 : 0)
  }, 0)
}

/**
 * GET /api/stats/courant?year=2026
 *
 * Returns aggregated stats for all non-revision dossiers for the given exercise year.
 * Handles exercise offset (clôtures décalées).
 */
export async function GET(req: NextRequest) {
  const tenantId = await getTenantId()
  const year = parseInt(req.nextUrl.searchParams.get("year") || String(new Date().getFullYear()))

  // 1. Fetch all active non-revision dossiers with their collaborateur
  const dossiers = await prisma.dossier.findMany({
    where: {
      tenantId,
      statut: "ACTIF",
      NOT: { typeMission: "REVISION" },
    },
    select: {
      id: true,
      raisonSociale: true,
      dateClotureExercice: true,
      collaborateurPrincipalId: true,
      collaborateurPrincipal: { select: { id: true, prenom: true } },
    },
  })

  // 2. For each dossier, compute the 12 calendar periods for this exercise year
  //    and collect all unique periods we need to fetch
  const allPeriodes = new Set<string>()
  const dossierMeta: {
    dossierId: string
    raisonSociale: string
    collabId: string | null
    collabPrenom: string
    clotureMois: number
    m1Mois: number
    exerciseYear: number
    periodes: string[] // 12 calendar periods (M1..M12)
  }[] = []

  for (const d of dossiers) {
    const clotureMois = getClotureMois(d.dateClotureExercice)
    const m1Mois = getM1Mois(clotureMois)

    // Exercise year: for standard Dec clôture, M1=Jan of `year`.
    // For offset e.g. Mar clôture, M1=Apr of `year`, so exerciseYear = year.
    const exerciseYear = year
    const periodes: string[] = []
    for (let mx = 1; mx <= 12; mx++) {
      const cal = exerciseMonthToCalendar(mx, m1Mois, exerciseYear)
      const p = fmtPeriode(cal.year, cal.month)
      periodes.push(p)
      allPeriodes.add(p)
    }

    dossierMeta.push({
      dossierId: d.id,
      raisonSociale: d.raisonSociale,
      collabId: d.collaborateurPrincipalId,
      collabPrenom: d.collaborateurPrincipal?.prenom ?? "Non affecté",
      clotureMois,
      m1Mois,
      exerciseYear,
      periodes,
    })
  }

  // 3. Fetch all suivi_courants for these periods
  const dossierIds = dossiers.map((d) => d.id)
  const suivis = await prisma.suiviCourant.findMany({
    where: {
      tenantId,
      dossierId: { in: dossierIds },
      periode: { in: Array.from(allPeriodes) },
    },
  })

  // Index: dossierId → periode → suivi
  const suiviIndex: Record<string, Record<string, typeof suivis[0]>> = {}
  for (const s of suivis) {
    if (!suiviIndex[s.dossierId]) suiviIndex[s.dossierId] = {}
    suiviIndex[s.dossierId][s.periode] = s
  }

  // 4. Compute stats
  const now = new Date()
  const nowPeriode = fmtPeriode(now.getFullYear(), now.getMonth())

  // Per exercise month M1..M12: average % across all dossiers
  const monthlyGlobal: { moisExercice: number; avgPct: number; totalDossiers: number }[] = []
  // Per collaborateur per month
  const collabMonthly: Record<string, { prenom: string; nbDossiers: number; months: number[] }> = {}
  // Per tâche: count EFFECTUE / EN_COURS / none across all dossiers and months
  const tacheStats: Record<string, { effectue: number; enCours: number; aucun: number }> = {}
  for (const t of TACHES) {
    tacheStats[t.key] = { effectue: 0, enCours: 0, aucun: 0 }
  }

  // Track incomplete tâches (for "tâche la plus incomplète" KPI)
  const tacheIncomplete: Record<string, number> = {}
  for (const t of TACHES) tacheIncomplete[t.key] = 0

  let totalPctSum = 0
  let totalMonthCount = 0
  let dossiers100 = 0
  let dossiersEnRetard = 0

  // Initialize collab tracking
  for (const dm of dossierMeta) {
    const key = dm.collabId ?? "__none__"
    if (!collabMonthly[key]) {
      collabMonthly[key] = { prenom: dm.collabPrenom, nbDossiers: 0, months: new Array(12).fill(0) }
    }
    collabMonthly[key].nbDossiers++
  }

  // Per month aggregation
  for (let mx = 1; mx <= 12; mx++) {
    let monthSum = 0
    let monthCount = 0
    // Per collab accumulator for this month
    const collabSum: Record<string, { sum: number; count: number }> = {}

    for (const dm of dossierMeta) {
      const periode = dm.periodes[mx - 1]
      const suivi = suiviIndex[dm.dossierId]?.[periode]
      const done = suivi ? countDone(suivi as Record<string, unknown>) : 0
      const pct = Math.round((done / NB_TACHES) * 100)

      monthSum += pct
      monthCount++

      const ck = dm.collabId ?? "__none__"
      if (!collabSum[ck]) collabSum[ck] = { sum: 0, count: 0 }
      collabSum[ck].sum += pct
      collabSum[ck].count++

      // Tâche stats (count across all months and dossiers)
      if (suivi) {
        for (const t of TACHES) {
          const v = (suivi as Record<string, unknown>)[t.key]
          if (v === "EFFECTUE") tacheStats[t.key].effectue++
          else if (v === "EN_COURS") tacheStats[t.key].enCours++
          else tacheStats[t.key].aucun++
        }
      } else {
        for (const t of TACHES) {
          tacheStats[t.key].aucun++
        }
      }
    }

    monthlyGlobal.push({
      moisExercice: mx,
      avgPct: monthCount > 0 ? Math.round(monthSum / monthCount) : 0,
      totalDossiers: monthCount,
    })

    // Assign per-collab monthly avg
    for (const [ck, cs] of Object.entries(collabSum)) {
      if (collabMonthly[ck]) {
        collabMonthly[ck].months[mx - 1] = cs.count > 0 ? Math.round(cs.sum / cs.count) : 0
      }
    }
  }

  // Dossier-level stats: 100% à jour and en retard
  for (const dm of dossierMeta) {
    let allComplete = true
    let hasRetard = false

    for (let mx = 1; mx <= 12; mx++) {
      const periode = dm.periodes[mx - 1]
      const suivi = suiviIndex[dm.dossierId]?.[periode]
      const done = suivi ? countDone(suivi as Record<string, unknown>) : 0

      // Only count months that should be done (calendar month <= now)
      if (periode <= nowPeriode) {
        totalPctSum += Math.round((done / NB_TACHES) * 100)
        totalMonthCount++

        if (done < NB_TACHES) {
          allComplete = false
          if (!suivi || countStarted(suivi as Record<string, unknown>) < NB_TACHES) {
            hasRetard = true
          }
          // Track which tâches are incomplete
          for (const t of TACHES) {
            const v = suivi ? (suivi as Record<string, unknown>)[t.key] : null
            if (v !== "EFFECTUE") tacheIncomplete[t.key]++
          }
        }
      }
    }

    if (allComplete) dossiers100++
    if (hasRetard) dossiersEnRetard++
  }

  // Find most blocking tâche
  let tachePlusIncomplete = { key: "", label: "", count: 0 }
  for (const t of TACHES) {
    if (tacheIncomplete[t.key] > tachePlusIncomplete.count) {
      tachePlusIncomplete = { key: t.key, label: t.label, count: tacheIncomplete[t.key] }
    }
  }

  const avgGlobal = totalMonthCount > 0 ? Math.round(totalPctSum / totalMonthCount) : 0

  // Format collab table
  const collabTable = Object.entries(collabMonthly)
    .map(([id, data]) => ({
      id,
      prenom: data.prenom,
      nbDossiers: data.nbDossiers,
      months: data.months,
      global: data.months.reduce((s, v) => s + v, 0) > 0
        ? Math.round(data.months.reduce((s, v) => s + v, 0) / data.months.filter((v) => v > 0).length || 1)
        : 0,
    }))
    .sort((a, b) => b.nbDossiers - a.nbDossiers)

  // Cabinet average per month
  const cabinetMonths = monthlyGlobal.map((m) => m.avgPct)
  const cabinetGlobal = cabinetMonths.reduce((s, v) => s + v, 0) > 0
    ? Math.round(cabinetMonths.reduce((s, v) => s + v, 0) / cabinetMonths.filter((v) => v > 0).length || 1)
    : 0

  // Tâche stats formatted
  const tacheStatsFormatted = TACHES.map((t) => ({
    key: t.key,
    label: t.label,
    effectue: tacheStats[t.key].effectue,
    enCours: tacheStats[t.key].enCours,
    aucun: tacheStats[t.key].aucun,
  }))

  return NextResponse.json({
    year,
    totalDossiers: dossiers.length,
    kpi: {
      avgGlobal,
      dossiers100,
      dossiersEnRetard,
      tachePlusIncomplete,
    },
    monthlyGlobal,
    collabTable,
    cabinetMonths,
    cabinetGlobal,
    tacheStats: tacheStatsFormatted,
    collabList: Object.entries(collabMonthly).map(([id, d]) => ({
      id,
      prenom: d.prenom,
      months: d.months,
    })),
  })
}
