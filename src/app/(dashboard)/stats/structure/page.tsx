import { prisma } from "@/lib/db/prisma"
import { getTenantId } from "@/lib/tenant"
import Link from "next/link"

export const dynamic = "force-dynamic"

export default async function StatsStructurePage() {
  let tenantId: string
  try {
    tenantId = await getTenantId()
  } catch {
    return <p className="p-8 text-gray-500">Aucun tenant configuré.</p>
  }

  const [
    parFormeJuridique,
    parRegimeFiscal,
    parRegimeTva,
    parLogiciel,
    dossiers,
  ] = await Promise.all([
    prisma.dossier.groupBy({
      by: ["formeJuridique"],
      where: { tenantId },
      _count: true,
      orderBy: { _count: { formeJuridique: "desc" } },
    }),
    prisma.dossier.groupBy({
      by: ["regimeFiscal"],
      where: { tenantId },
      _count: true,
    }),
    prisma.dossier.groupBy({
      by: ["regimeTva"],
      where: { tenantId },
      _count: true,
      orderBy: { _count: { regimeTva: "desc" } },
    }),
    prisma.dossier.groupBy({
      by: ["logicielComptable"],
      where: { tenantId },
      _count: true,
      orderBy: { _count: { logicielComptable: "desc" } },
    }),
    prisma.dossier.findMany({
      where: { tenantId },
      select: {
        collaborateurPrincipalId: true,
        collaborateurPrincipal: { select: { id: true, prenom: true } },
      },
    }),
  ])

  const totalDossiers = dossiers.length

  // Dossiers par collaborateur
  const collabCounts = new Map<string, { prenom: string; count: number }>()
  for (const d of dossiers) {
    const key = d.collaborateurPrincipal?.prenom ?? "Non affecté"
    const existing = collabCounts.get(key)
    if (existing) existing.count++
    else collabCounts.set(key, { prenom: key, count: 1 })
  }
  const parCollaborateur = Array.from(collabCounts.values()).sort((a, b) => b.count - a.count)

  const formeLabels: Record<string, string> = {
    SAS: "SAS", SCI: "SCI", SARL: "SARL", EURL: "EURL", SASU: "SASU",
    EI: "EI", BNC: "BNC", LMNP: "LMNP", SNC: "SNC", SEP: "SEP",
    SC: "SC", SOCIETE_CIVILE: "Société Civile", ASSOCIATION: "Association",
    AUTO_ENTREPRENEUR: "Auto-Entrepreneur",
  }

  const tvaLabels: Record<string, string> = {
    RM: "Réel mensuel", RT: "Réel trimestriel", ST: "Simplifié", EXONERE: "Exonéré",
  }

  const maxForme = Math.max(...parFormeJuridique.map((r) => r._count), 1)
  const maxTva = Math.max(...parRegimeTva.map((r) => r._count), 1)
  const maxCollab = Math.max(...parCollaborateur.map((c) => c.count), 1)
  const maxLogiciel = Math.max(...parLogiciel.map((r) => r._count), 1)

  // IS/IR pour donut
  const isCount = parRegimeFiscal.find((r) => r.regimeFiscal === "IS")?._count ?? 0
  const irCount = parRegimeFiscal.find((r) => r.regimeFiscal === "IR")?._count ?? 0
  const nonRenseigne = totalDossiers - isCount - irCount
  const isPct = totalDossiers > 0 ? Math.round((isCount / totalDossiers) * 100) : 0
  const irPct = totalDossiers > 0 ? Math.round((irCount / totalDossiers) * 100) : 0

  return (
    <main className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Statistiques — Structure</h1>
        <p className="text-sm text-gray-500">Radiographie du cabinet</p>
      </div>
        {/* Sub-nav */}
        <div className="mb-8 flex gap-4">
          <Link href="/stats/structure" className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white">
            Structure
          </Link>
          <Link href="/stats/avancement" className="rounded-lg border bg-white px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50">
            Avancement
          </Link>
          <Link href="/stats/courant" className="rounded-lg border bg-white px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50">
            Courant
          </Link>
        </div>

        <div className="grid gap-8 lg:grid-cols-2">
          {/* Formes juridiques — barres */}
          <div className="rounded-lg border bg-white p-6">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-500">
              Formes juridiques
            </h2>
            <div className="space-y-2">
              {parFormeJuridique.map((r) => (
                <div key={r.formeJuridique ?? "null"} className="flex items-center gap-3">
                  <span className="w-28 text-right text-sm text-gray-700">
                    {r.formeJuridique ? formeLabels[r.formeJuridique] ?? r.formeJuridique : "N/R"}
                  </span>
                  <div className="flex-1">
                    <div className="h-5 rounded bg-gray-100">
                      <div
                        className="flex h-5 items-center rounded bg-blue-500 px-2 text-xs font-medium text-white"
                        style={{ width: `${(r._count / maxForme) * 100}%`, minWidth: "2rem" }}
                      >
                        {r._count}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Régime fiscal — donut simplifié */}
          <div className="rounded-lg border bg-white p-6">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-500">
              Régime fiscal
            </h2>
            <div className="flex items-center justify-center gap-12">
              {/* Faux donut CSS */}
              <div className="relative h-40 w-40">
                <svg viewBox="0 0 36 36" className="h-40 w-40 -rotate-90">
                  <circle cx="18" cy="18" r="15.9" fill="none" stroke="#e5e7eb" strokeWidth="3" />
                  <circle
                    cx="18" cy="18" r="15.9" fill="none"
                    stroke="#3b82f6" strokeWidth="3"
                    strokeDasharray={`${isPct} ${100 - isPct}`}
                    strokeDashoffset="0"
                  />
                  <circle
                    cx="18" cy="18" r="15.9" fill="none"
                    stroke="#f59e0b" strokeWidth="3"
                    strokeDasharray={`${irPct} ${100 - irPct}`}
                    strokeDashoffset={`${-isPct}`}
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-2xl font-bold text-gray-900">{totalDossiers}</span>
                  <span className="text-xs text-gray-500">dossiers</span>
                </div>
              </div>
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className="inline-block h-3 w-3 rounded-full bg-blue-500" />
                  <span className="text-sm text-gray-700">IS — {isCount} ({isPct}%)</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="inline-block h-3 w-3 rounded-full bg-amber-500" />
                  <span className="text-sm text-gray-700">IR — {irCount} ({irPct}%)</span>
                </div>
                {nonRenseigne > 0 && (
                  <div className="flex items-center gap-2">
                    <span className="inline-block h-3 w-3 rounded-full bg-gray-300" />
                    <span className="text-sm text-gray-700">N/R — {nonRenseigne}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Régime TVA — barres horizontales */}
          <div className="rounded-lg border bg-white p-6">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-500">
              Régimes TVA
            </h2>
            <div className="space-y-2">
              {parRegimeTva.map((r) => (
                <div key={r.regimeTva ?? "null"} className="flex items-center gap-3">
                  <span className="w-28 text-right text-sm text-gray-700">
                    {r.regimeTva ? tvaLabels[r.regimeTva] ?? r.regimeTva : "N/R"}
                  </span>
                  <div className="flex-1">
                    <div className="h-5 rounded bg-gray-100">
                      <div
                        className="flex h-5 items-center rounded bg-teal-500 px-2 text-xs font-medium text-white"
                        style={{ width: `${(r._count / maxTva) * 100}%`, minWidth: "2rem" }}
                      >
                        {r._count}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Dossiers par collaborateur */}
          <div className="rounded-lg border bg-white p-6">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-500">
              Dossiers par collaborateur
            </h2>
            <div className="space-y-2">
              {parCollaborateur.map((c) => (
                <div key={c.prenom} className="flex items-center gap-3">
                  <span className="w-28 text-right text-sm text-gray-700">{c.prenom}</span>
                  <div className="flex-1">
                    <div className="h-5 rounded bg-gray-100">
                      <div
                        className="flex h-5 items-center rounded bg-indigo-500 px-2 text-xs font-medium text-white"
                        style={{ width: `${(c.count / maxCollab) * 100}%`, minWidth: "2rem" }}
                      >
                        {c.count}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Logiciels comptables */}
          <div className="rounded-lg border bg-white p-6 lg:col-span-2">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-500">
              Logiciels comptables
            </h2>
            <div className="space-y-2">
              {parLogiciel.map((r) => (
                <div key={r.logicielComptable ?? "null"} className="flex items-center gap-3">
                  <span className="w-28 text-right text-sm text-gray-700">
                    {r.logicielComptable ?? "Non renseigné"}
                  </span>
                  <div className="flex-1">
                    <div className="h-5 rounded bg-gray-100">
                      <div
                        className="flex h-5 items-center rounded bg-purple-500 px-2 text-xs font-medium text-white"
                        style={{ width: `${(r._count / maxLogiciel) * 100}%`, minWidth: "2rem" }}
                      >
                        {r._count}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
    </main>
  )
}
