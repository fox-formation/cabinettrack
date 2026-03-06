import { prisma } from "@/lib/db/prisma"
import { getTenantId } from "@/lib/tenant"
import { calculerAvancement } from "@/lib/dossiers/avancement"
import { addDays } from "date-fns"
import Link from "next/link"

export const dynamic = "force-dynamic"

export default async function DashboardPage() {
  let tenantId: string
  try {
    tenantId = await getTenantId()
  } catch {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-gray-500">Aucun tenant configuré. Lancez le script d&apos;import.</p>
      </div>
    )
  }

  const now = new Date()
  const dans7jours = addDays(now, 7)

  const [dossiers, echeances7j, alertesCount, cabinets, repartitionTva] = await Promise.all([
    prisma.dossier.findMany({
      where: { tenantId },
      include: {
        collaborateurPrincipal: { select: { prenom: true } },
        cabinet: { select: { nom: true } },
      },
    }),
    prisma.echeance.count({
      where: {
        tenantId,
        statut: "A_FAIRE",
        dateEcheance: { gte: now, lte: dans7jours },
      },
    }),
    prisma.alerte.count({
      where: { tenantId, acquittee: false, niveau: { in: ["WARNING", "URGENT", "CRITIQUE"] } },
    }),
    prisma.cabinet.findMany({
      where: { tenantId },
      include: { _count: { select: { dossiers: true } } },
    }),
    prisma.dossier.groupBy({
      by: ["regimeTva"],
      where: { tenantId },
      _count: true,
    }),
  ])

  const dans30jours = addDays(now, 30)

  const dossiersEnRetard = dossiers.filter(
    (d) => d.datePrevueArreteBilan && new Date(d.datePrevueArreteBilan) < now && !d.dateArreteBilan
  )

  const dossiersBilan30j = dossiers.filter((d) => {
    if (!d.datePrevueArreteBilan || d.dateArreteBilan) return false
    const dateLimite = new Date(d.datePrevueArreteBilan)
    return dateLimite >= now && dateLimite <= dans30jours
  })

  const avancements = dossiers.map((d) => calculerAvancement(d))
  const avancementMoyen =
    avancements.length > 0
      ? Math.round(avancements.reduce((a, b) => a + b, 0) / avancements.length)
      : 0

  const top5 = dossiersEnRetard
    .map((d) => ({
      id: d.id,
      raisonSociale: d.raisonSociale,
      cabinet: d.cabinet.nom,
      collaborateur: d.collaborateurPrincipal?.prenom ?? "-",
      joursRetard: Math.floor(
        (now.getTime() - new Date(d.datePrevueArreteBilan!).getTime()) / 86400000
      ),
      avancement: calculerAvancement(d),
    }))
    .sort((a, b) => b.joursRetard - a.joursRetard)
    .slice(0, 5)

  const tvaLabels: Record<string, string> = {
    RM: "Réel mensuel", RT: "Réel trimestriel", ST: "Simplifié", EXONERE: "Exonéré",
  }

  return (
    <main className="p-8">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-gray-800">Tableau de bord</h1>
        <p className="text-xs text-gray-400">Vue d&apos;ensemble du cabinet</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <KpiCard label="Dossiers en retard" value={dossiersEnRetard.length} total={dossiers.length} accent="red" />
        <KpiCard label="Bilan < 30 jours" value={dossiersBilan30j.length} accent="amber" />
        <KpiCard label="Échéances < 7 jours" value={echeances7j} accent="amber" />
        <KpiCard label="Alertes" value={alertesCount} accent="amber" />
        <KpiCard label="Avancement moyen" value={`${avancementMoyen}%`} accent="default" progress={avancementMoyen} />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        {/* Répartition TVA */}
        <div className="rounded border border-gray-200 bg-white p-5">
          <h2 className="mb-3 text-[10px] font-medium uppercase tracking-wide text-gray-400">Répartition TVA</h2>
          <div className="space-y-2.5">
            {repartitionTva.sort((a, b) => b._count - a._count).map((r) => {
              const regime = r.regimeTva ?? "null"
              const label = r.regimeTva ? tvaLabels[r.regimeTva] ?? r.regimeTva : "Non renseigné"
              const pct = Math.round((r._count / dossiers.length) * 100)
              return (
                <div key={regime}>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-600">{label}</span>
                    <span className="font-medium text-gray-500">{r._count} ({pct}%)</span>
                  </div>
                  <div className="mt-1 h-1 rounded-full bg-gray-100">
                    <div className="h-1 rounded-full bg-gray-400" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Cabinets */}
        <div className="rounded border border-gray-200 bg-white p-5">
          <h2 className="mb-3 text-[10px] font-medium uppercase tracking-wide text-gray-400">Cabinets</h2>
          <div className="space-y-2.5">
            {cabinets.map((c) => (
              <div key={c.id} className="flex items-center justify-between">
                <span className="text-xs font-medium text-gray-700">{c.nom}</span>
                <span className="text-xs text-gray-500">{c._count.dossiers} dossiers</span>
              </div>
            ))}
            <div className="border-t border-gray-100 pt-2.5">
              <div className="flex items-center justify-between text-xs font-medium text-gray-700">
                <span>Total</span>
                <span>{dossiers.length}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Top 5 retard */}
        <div className="rounded border border-gray-200 bg-white p-5">
          <h2 className="mb-3 text-[10px] font-medium uppercase tracking-wide text-gray-400">Top 5 retards bilan</h2>
          {top5.length === 0 ? (
            <p className="text-xs text-gray-400">Aucun dossier en retard</p>
          ) : (
            <div className="space-y-2">
              {top5.map((d) => (
                <Link key={d.id} href={`/dossiers/${d.id}`} className="block rounded border border-gray-100 p-2.5 transition-colors hover:bg-gray-50">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-gray-700">{d.raisonSociale}</span>
                    <span className="text-[10px] font-medium text-red-500">J+{d.joursRetard}</span>
                  </div>
                  <div className="mt-0.5 flex items-center gap-1.5 text-[10px] text-gray-400">
                    <span>{d.cabinet}</span><span>·</span><span>{d.collaborateur}</span><span>·</span><span>{d.avancement}%</span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Quick links */}
      <div className="mt-6 flex gap-2">
        <Link href="/api/exports/dossiers" className="rounded border border-gray-200 bg-white px-3 py-1.5 text-xs text-gray-500 transition-colors hover:bg-gray-50">
          Exporter dossiers CSV
        </Link>
        <Link href="/api/exports/echeances?annee=2026" className="rounded border border-gray-200 bg-white px-3 py-1.5 text-xs text-gray-500 transition-colors hover:bg-gray-50">
          Exporter échéances CSV
        </Link>
      </div>
    </main>
  )
}

function KpiCard({
  label, value, total, accent, progress,
}: {
  label: string
  value: number | string
  total?: number
  accent: "red" | "amber" | "default"
  progress?: number
}) {
  const valueColor = accent === "red" ? "text-red-600" : accent === "amber" ? "text-amber-600" : "text-gray-800"

  return (
    <div className="rounded border border-gray-200 bg-white px-4 py-3">
      <p className="text-[10px] font-medium uppercase tracking-wide text-gray-400">{label}</p>
      <p className={`mt-1 text-xl font-semibold ${valueColor}`}>
        {value}
        {total !== undefined && <span className="text-sm font-normal text-gray-400"> / {total}</span>}
      </p>
      {progress !== undefined && (
        <div className="mt-2 h-1 rounded-full bg-gray-100">
          <div
            className={`h-1 rounded-full transition-all ${
              progress >= 100 ? "bg-green-500" : progress > 50 ? "bg-amber-400" : "bg-red-400"
            }`}
            style={{ width: `${progress}%` }}
          />
        </div>
      )}
    </div>
  )
}
