import { prisma } from "@/lib/db/prisma"
import { getTenantId } from "@/lib/tenant"
import { calculerAvancement, ETAPES_BILAN } from "@/lib/dossiers/avancement"
import Link from "next/link"

export const dynamic = "force-dynamic"

interface SearchParams {
  collaborateur?: string
  assistant?: string
  cloture?: string
}

const ROLE_LABELS: Record<string, string> = {
  ASSISTANT: "Assistant",
  CONFIRME: "Confirmé",
  SUPERVISEUR: "Superviseur",
  EXPERT_COMPTABLE: "Expert-EC",
}

export default async function StatsAvancementPage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  let tenantId: string
  try {
    tenantId = await getTenantId()
  } catch {
    return <p className="p-8 text-gray-500">Aucun tenant configuré.</p>
  }

  const { collaborateur, assistant, cloture } = searchParams
  const now = new Date()
  const clotureMonth = cloture ? parseInt(cloture) : null

  // Fetch collaborateurs for filter selects
  const collaborateurs = await prisma.user.findMany({
    where: { tenantId },
    select: { id: true, prenom: true, role: true },
    orderBy: { prenom: "asc" },
  })

  // Build where clause
  const where: Record<string, unknown> = { tenantId }
  if (collaborateur) {
    where.collaborateurPrincipalId = collaborateur
  }
  if (assistant) {
    where.collaborateursSecondaires = {
      some: { userId: assistant },
    }
  }

  const allDossiers = await prisma.dossier.findMany({
    where,
    include: {
      collaborateurPrincipal: { select: { id: true, prenom: true } },
    },
  })

  // Filter by cloture month (Prisma can't EXTRACT month)
  const dossiers = clotureMonth && clotureMonth >= 1 && clotureMonth <= 12
    ? allDossiers.filter((d) => d.dateClotureExercice && new Date(d.dateClotureExercice).getUTCMonth() + 1 === clotureMonth)
    : allDossiers

  // Calcul avancement
  const dossiersAv = dossiers.map((d) => ({
    ...d,
    avancement: calculerAvancement(d),
  }))

  const termines = dossiersAv.filter((d) => d.avancement >= 100).length
  const enCours = dossiersAv.filter((d) => d.avancement > 0 && d.avancement < 100).length
  const nonDemarres = dossiersAv.filter((d) => d.avancement === 0).length
  const avancementGlobal = dossiers.length > 0
    ? Math.round((termines / dossiers.length) * 100)
    : 0

  // Par collaborateur
  const collabMap = new Map<string, {
    id: string
    prenom: string
    total: number
    termines: number
    enCours: number
    nonDemarres: number
    retards: number
    sumAvancement: number
  }>()

  for (const d of dossiersAv) {
    const key = d.collaborateurPrincipal?.id ?? "__none__"
    if (!collabMap.has(key)) {
      collabMap.set(key, {
        id: key,
        prenom: d.collaborateurPrincipal?.prenom ?? "Non affecté",
        total: 0,
        termines: 0,
        enCours: 0,
        nonDemarres: 0,
        retards: 0,
        sumAvancement: 0,
      })
    }
    const c = collabMap.get(key)!
    c.total++
    c.sumAvancement += d.avancement
    if (d.avancement >= 100) c.termines++
    else if (d.avancement > 0) c.enCours++
    else c.nonDemarres++
    if (d.datePrevueArreteBilan && new Date(d.datePrevueArreteBilan) < now && d.dateArreteBilan === null) {
      c.retards++
    }
  }

  const parCollaborateur = Array.from(collabMap.values())
    .map((c) => ({ ...c, avancementMoyen: c.total > 0 ? Math.round(c.sumAvancement / c.total) : 0 }))
    .sort((a, b) => b.total - a.total)

  // Par étape (seulement poids > 0)
  const parEtape = ETAPES_BILAN.filter((e) => e.poids > 0).map((etape) => {
    let effectue = 0
    let etapeEnCours = 0
    let restant = 0
    for (const d of dossiers) {
      const val = d[etape.cle]
      if (val === "EFFECTUE") effectue++
      else if (val === "EN_COURS") etapeEnCours++
      else restant++
    }
    return { label: etape.label, poids: etape.poids, effectue, enCours: etapeEnCours, restant }
  })

  // Urgences
  const urgences = dossiersAv
    .filter((d) => d.avancement < 100 && d.datePrevueArreteBilan)
    .map((d) => {
      const datePrevue = new Date(d.datePrevueArreteBilan!)
      const diffJours = Math.floor((datePrevue.getTime() - now.getTime()) / 86400000)
      return {
        id: d.id,
        raisonSociale: d.raisonSociale,
        collaborateur: d.collaborateurPrincipal?.prenom ?? "-",
        datePrevue: d.datePrevueArreteBilan!,
        joursRestants: diffJours,
        avancement: d.avancement,
        etapesRestantes: ETAPES_BILAN.filter((etape) => {
          if (etape.poids === 0) return false
          const val = d[etape.cle]
          return val !== "EFFECTUE"
        }).map((e) => e.label),
      }
    })
    .sort((a, b) => a.joursRestants - b.joursRestants)
    .slice(0, 30)

  // Dossiers list for single-collaborateur detail view
  const isSingleCollab = !!collaborateur
  const collabDossiers = isSingleCollab
    ? dossiersAv
        .sort((a, b) => a.avancement - b.avancement)
        .map((d) => ({
          id: d.id,
          raisonSociale: d.raisonSociale,
          avancement: d.avancement,
          datePrevue: d.datePrevueArreteBilan,
          joursRestants: d.datePrevueArreteBilan
            ? Math.floor((new Date(d.datePrevueArreteBilan).getTime() - now.getTime()) / 86400000)
            : null,
        }))
    : []

  const hasFilters = collaborateur || assistant || cloture

  return (
    <main className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Statistiques — Avancement bilans</h1>
        <p className="text-sm text-gray-500">Suivi de l&apos;avancement des bilans</p>
      </div>

      {/* Sub-nav */}
      <div className="mb-6 flex gap-4">
        <Link href="/stats/structure" className="rounded-lg border bg-white px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50">
          Structure
        </Link>
        <Link href="/stats/avancement" className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white">
          Avancement
        </Link>
        <Link href="/stats/courant" className="rounded-lg border bg-white px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50">
          Courant
        </Link>
      </div>

      {/* Filters */}
      <form className="mb-6 flex flex-wrap items-center gap-3">
        <select
          name="collaborateur"
          defaultValue={collaborateur ?? ""}
          className="rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-blue-500 focus:outline-none"
        >
          <option value="">Tous les collaborateurs</option>
          {collaborateurs.map((c) => (
            <option key={c.id} value={c.id}>
              {c.prenom} ({ROLE_LABELS[c.role] ?? c.role})
            </option>
          ))}
        </select>
        <select
          name="assistant"
          defaultValue={assistant ?? ""}
          className="rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-blue-500 focus:outline-none"
        >
          <option value="">Tous les assistants</option>
          {collaborateurs.map((c) => (
            <option key={c.id} value={c.id}>
              {c.prenom} ({ROLE_LABELS[c.role] ?? c.role})
            </option>
          ))}
        </select>
        <select
          name="cloture"
          defaultValue={cloture ?? ""}
          className="rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-blue-500 focus:outline-none"
        >
          <option value="">Toutes les clôtures</option>
          <option value="1">Janvier</option>
          <option value="2">Février</option>
          <option value="3">Mars</option>
          <option value="4">Avril</option>
          <option value="5">Mai</option>
          <option value="6">Juin</option>
          <option value="7">Juillet</option>
          <option value="8">Août</option>
          <option value="9">Septembre</option>
          <option value="10">Octobre</option>
          <option value="11">Novembre</option>
          <option value="12">Décembre</option>
        </select>
        <button
          type="submit"
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          Filtrer
        </button>
        {hasFilters && (
          <Link
            href="/stats/avancement"
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            Réinitialiser
          </Link>
        )}
      </form>

      {/* Bloc 1 — Vue globale */}
      <div className="mb-8 rounded-lg border bg-white p-6">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-500">
          Vue globale bilan annuel
        </h2>
        <div className="mb-4 grid grid-cols-3 gap-4 text-center">
          <div className="rounded-lg bg-green-50 p-4">
            <p className="text-3xl font-bold text-green-700">{termines}</p>
            <p className="text-sm text-green-600">Terminés (100%)</p>
          </div>
          <div className="rounded-lg bg-amber-50 p-4">
            <p className="text-3xl font-bold text-amber-700">{enCours}</p>
            <p className="text-sm text-amber-600">En cours (1-99%)</p>
          </div>
          <div className="rounded-lg bg-gray-100 p-4">
            <p className="text-3xl font-bold text-gray-700">{nonDemarres}</p>
            <p className="text-sm text-gray-500">Non démarrés (0%)</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex-1">
            <div className="h-4 rounded-full bg-gray-200">
              <div
                className="h-4 rounded-full bg-green-500 transition-all"
                style={{ width: `${avancementGlobal}%` }}
              />
            </div>
          </div>
          <span className="text-lg font-bold text-gray-900">{avancementGlobal}%</span>
        </div>
        <p className="mt-1 text-xs text-gray-400">
          {termines} dossier{termines > 1 ? "s" : ""} sur {dossiers.length} à 100%
        </p>
      </div>

      {/* Bloc 2 — Par collaborateur */}
      <div className="mb-8 rounded-lg border bg-white p-6">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-500">
          {isSingleCollab && parCollaborateur.length === 1
            ? `Dossiers de ${parCollaborateur[0].prenom}`
            : "Par collaborateur"}
        </h2>

        {/* Standard table view (no collaborateur filter or multiple collabs) */}
        {!isSingleCollab && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs font-medium uppercase tracking-wide text-gray-500">
                  <th className="pb-3 pr-4">Collaborateur</th>
                  <th className="pb-3 pr-4 text-center">Dossiers</th>
                  <th className="pb-3 pr-4 text-center">Terminés</th>
                  <th className="pb-3 pr-4 text-center">En cours</th>
                  <th className="pb-3 pr-4 text-center">Non dém.</th>
                  <th className="pb-3 pr-4 text-center">Retards</th>
                  <th className="pb-3 w-48">Avancement</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {parCollaborateur.map((c) => (
                  <tr key={c.id} className="hover:bg-gray-50">
                    <td className="py-3 pr-4 font-medium text-gray-900">{c.prenom}</td>
                    <td className="py-3 pr-4 text-center text-gray-700">{c.total}</td>
                    <td className="py-3 pr-4 text-center text-green-600 font-medium">{c.termines}</td>
                    <td className="py-3 pr-4 text-center text-amber-600">{c.enCours}</td>
                    <td className="py-3 pr-4 text-center text-gray-400">{c.nonDemarres}</td>
                    <td className="py-3 pr-4 text-center">
                      {c.retards > 0 ? (
                        <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">{c.retards}</span>
                      ) : (
                        <span className="text-gray-300">0</span>
                      )}
                    </td>
                    <td className="py-3">
                      <div className="flex items-center gap-2">
                        <div className="flex-1">
                          <div className="h-2.5 rounded-full bg-gray-200">
                            <div
                              className={`h-2.5 rounded-full transition-all ${
                                c.avancementMoyen >= 75 ? "bg-green-500"
                                  : c.avancementMoyen >= 50 ? "bg-blue-500"
                                    : c.avancementMoyen >= 25 ? "bg-amber-500"
                                      : "bg-red-500"
                              }`}
                              style={{ width: `${c.avancementMoyen}%` }}
                            />
                          </div>
                        </div>
                        <span className="w-10 text-right text-xs font-medium text-gray-600">{c.avancementMoyen}%</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Detailed dossier list when filtered by single collaborateur */}
        {isSingleCollab && (
          <div>
            {parCollaborateur.length > 0 && (
              <div className="mb-4 flex items-center gap-6 text-sm">
                <span className="text-gray-500">{parCollaborateur[0].total} dossiers</span>
                <span className="text-green-600">{parCollaborateur[0].termines} terminés</span>
                <span className="text-amber-600">{parCollaborateur[0].enCours} en cours</span>
                <span className="text-gray-400">{parCollaborateur[0].nonDemarres} non démarrés</span>
                {parCollaborateur[0].retards > 0 && (
                  <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
                    {parCollaborateur[0].retards} retard{parCollaborateur[0].retards > 1 ? "s" : ""}
                  </span>
                )}
                <span className="font-medium text-gray-900">Moy. {parCollaborateur[0].avancementMoyen}%</span>
              </div>
            )}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs font-medium uppercase tracking-wide text-gray-500">
                    <th className="pb-3 pr-4">Dossier</th>
                    <th className="pb-3 pr-4">Date prévue</th>
                    <th className="pb-3 pr-4">Délai</th>
                    <th className="pb-3 w-48">Avancement</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {collabDossiers.map((d) => (
                    <tr key={d.id} className="hover:bg-gray-50">
                      <td className="py-3 pr-4">
                        <Link href={`/dossiers/${d.id}`} className="font-medium text-blue-600 hover:underline">
                          {d.raisonSociale}
                        </Link>
                      </td>
                      <td className="py-3 pr-4 font-mono text-xs text-gray-500">
                        {d.datePrevue ? new Date(d.datePrevue).toLocaleDateString("fr-FR") : "-"}
                      </td>
                      <td className="py-3 pr-4">
                        {d.joursRestants !== null ? (
                          d.joursRestants < 0 ? (
                            <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-bold text-red-700">
                              J+{Math.abs(d.joursRestants)}
                            </span>
                          ) : d.joursRestants <= 30 ? (
                            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-700">
                              J-{d.joursRestants}
                            </span>
                          ) : (
                            <span className="text-xs text-gray-400">J-{d.joursRestants}</span>
                          )
                        ) : (
                          <span className="text-gray-300">-</span>
                        )}
                      </td>
                      <td className="py-3">
                        <div className="flex items-center gap-2">
                          <div className="flex-1">
                            <div className="h-2.5 rounded-full bg-gray-200">
                              <div
                                className={`h-2.5 rounded-full transition-all ${
                                  d.avancement >= 100 ? "bg-green-500"
                                    : d.avancement >= 50 ? "bg-blue-500"
                                      : d.avancement >= 25 ? "bg-amber-500"
                                        : "bg-red-500"
                                }`}
                                style={{ width: `${Math.min(d.avancement, 100)}%` }}
                              />
                            </div>
                          </div>
                          <span className="w-10 text-right text-xs font-medium text-gray-600">{d.avancement}%</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Bloc 3 — Par étape */}
      <div className="mb-8 rounded-lg border bg-white p-6">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-500">
          Détail par étape
        </h2>
        <div className="space-y-3">
          {parEtape.map((etape) => {
            const total = etape.effectue + etape.enCours + etape.restant
            const pctEffectue = total > 0 ? Math.round((etape.effectue / total) * 100) : 0
            const pctEnCours = total > 0 ? Math.round((etape.enCours / total) * 100) : 0
            return (
              <div key={etape.label} className="flex items-center gap-4">
                <span className="w-36 text-sm text-gray-700">{etape.label}</span>
                <span className="w-8 text-right text-xs text-gray-400">{etape.poids}%</span>
                <div className="flex-1">
                  <div className="flex h-5 overflow-hidden rounded bg-gray-100">
                    {pctEffectue > 0 && (
                      <div className="flex items-center justify-center bg-green-500 text-xs text-white" style={{ width: `${pctEffectue}%` }}>
                        {etape.effectue}
                      </div>
                    )}
                    {pctEnCours > 0 && (
                      <div className="flex items-center justify-center bg-amber-400 text-xs text-white" style={{ width: `${pctEnCours}%` }}>
                        {etape.enCours}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex w-40 gap-2 text-xs text-gray-500">
                  <span className="text-green-600">{etape.effectue} fait</span>
                  <span className="text-amber-600">{etape.enCours} en cours</span>
                  <span className="text-gray-400">{etape.restant} restant</span>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Bloc 4 — Urgences */}
      <div className="rounded-lg border bg-white p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
            Dossiers à finir en urgence
          </h2>
          <Link
            href="/api/exports/avancement"
            className="rounded border px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50"
          >
            Exporter CSV
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs font-medium uppercase tracking-wide text-gray-500">
                <th className="pb-3 pr-4">Dossier</th>
                <th className="pb-3 pr-4">Collaborateur</th>
                <th className="pb-3 pr-4">Date prévue</th>
                <th className="pb-3 pr-4">Délai</th>
                <th className="pb-3 pr-4">Avancement</th>
                <th className="pb-3">Étapes restantes</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {urgences.map((u) => (
                <tr key={u.id} className="hover:bg-gray-50">
                  <td className="py-3 pr-4">
                    <Link href={`/dossiers/${u.id}`} className="font-medium text-blue-600 hover:underline">
                      {u.raisonSociale}
                    </Link>
                  </td>
                  <td className="py-3 pr-4 text-gray-700">{u.collaborateur}</td>
                  <td className="py-3 pr-4 text-gray-500">
                    {new Date(u.datePrevue).toLocaleDateString("fr-FR")}
                  </td>
                  <td className="py-3 pr-4">
                    {u.joursRestants < 0 ? (
                      <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-bold text-red-700">
                        J+{Math.abs(u.joursRestants)}
                      </span>
                    ) : u.joursRestants <= 30 ? (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-700">
                        J-{u.joursRestants}
                      </span>
                    ) : (
                      <span className="text-xs text-gray-400">J-{u.joursRestants}</span>
                    )}
                  </td>
                  <td className="py-3 pr-4">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-16 rounded-full bg-gray-200">
                        <div
                          className={`h-2 rounded-full ${u.avancement >= 50 ? "bg-blue-500" : "bg-red-500"}`}
                          style={{ width: `${u.avancement}%` }}
                        />
                      </div>
                      <span className="text-xs text-gray-500">{u.avancement}%</span>
                    </div>
                  </td>
                  <td className="py-3">
                    <div className="flex flex-wrap gap-1">
                      {u.etapesRestantes.map((e) => (
                        <span key={e} className="rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-500">
                          {e}
                        </span>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
              {urgences.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-gray-400">
                    Aucun dossier urgent
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  )
}
