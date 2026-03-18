"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import Link from "next/link"

// ── Types ──────────────────────────────────────────────

interface ActionOuverte {
  id: string
  dossierId: string
  dateContact: string
  statut: string
  sens: "SORTANT" | "ENTRANT"
  sujet: string | null
  resume: string | null
  dossier: {
    id: string
    raisonSociale: string
    collaborateurPrincipal: { prenom: string } | null
    cabinet: { nom: string }
  }
  collaborateur: { user: { id: string; prenom: string } } | null
}

interface EcheanceDossier {
  id: string
  raisonSociale: string
  collaborateurPrincipal: { id: string; prenom: string } | null
  cabinet: { nom: string }
}

interface EcheanceRetard {
  id: string
  libelle: string
  type: "FISCALE" | "SOCIALE" | "JURIDIQUE"
  dateEcheance: string
  statut: "A_FAIRE" | "EN_COURS"
  dossier: EcheanceDossier
}

// ── Config ─────────────────────────────────────────────

const ACTION_LABELS: Record<string, { label: string; bg: string; text: string }> = {
  ACTION_CABINET: { label: "Action cabinet", bg: "bg-red-100", text: "text-red-700" },
  ACTION_CLIENT:  { label: "Action client",  bg: "bg-orange-100", text: "text-orange-700" },
  ACTION_REQUISE: { label: "Action cabinet", bg: "bg-red-100", text: "text-red-700" },
  DEMANDE_CLIENT: { label: "Action client",  bg: "bg-orange-100", text: "text-orange-700" },
}

const SENS_LABELS: Record<string, { label: string; icon: string; bg: string; text: string }> = {
  SORTANT: { label: "Sortant", icon: "\u2197", bg: "bg-blue-100", text: "text-blue-700" },
  ENTRANT: { label: "Entrant", icon: "\u2199", bg: "bg-green-100", text: "text-green-700" },
}

const OBLIGATION_COLS = [
  { key: "TVA", label: "TVA", match: (l: string) => l.includes("TVA") || l.includes("CA3") || l.includes("CA12") },
  { key: "IS", label: "IS / Liasse", match: (l: string) => l.includes("IS") || l.includes("Liasse") || l.includes("2065") },
  { key: "AGO", label: "AGO", match: (l: string) => l.includes("AGO") || l.includes("Approbation") },
  { key: "DAS2", label: "DAS 2", match: (l: string) => l.includes("DAS") },
  { key: "CVAE", label: "CVAE", match: (l: string) => l.includes("CVAE") },
  { key: "CFE", label: "CFE", match: (l: string) => l.includes("CFE") },
  { key: "GREFFE", label: "Greffe", match: (l: string) => l.includes("Greffe") || l.includes("greffe") || l.includes("Dépôt") },
  { key: "2572", label: "2572", match: (l: string) => l.includes("2572") },
  { key: "AUTRE", label: "Autres", match: () => true },
] as const

function classifyEcheance(libelle: string): string {
  for (const col of OBLIGATION_COLS) {
    if (col.key !== "AUTRE" && col.match(libelle)) return col.key
  }
  return "AUTRE"
}

function calcJoursRetard(dateStr: string): number {
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  const d = new Date(dateStr)
  d.setHours(0, 0, 0, 0)
  return Math.floor((now.getTime() - d.getTime()) / 86400000)
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" })
}

// ── Component ──────────────────────────────────────────

export default function AlertesPage() {
  const [echeances, setEcheances] = useState<EcheanceRetard[]>([])
  const [actions, setActions] = useState<ActionOuverte[]>([])
  const [loading, setLoading] = useState(true)
  const [filtreType, setFiltreType] = useState<string>("")
  const [filtreRetardOnly, setFiltreRetardOnly] = useState(false)

  // Clore modal
  const [cloreModal, setCloreModal] = useState<{ id: string; sujet: string | null; resume: string | null } | null>(null)
  const [cloreReponse, setCloreReponse] = useState("")
  const [cloreSaving, setCloreSaving] = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const [echRes, actRes] = await Promise.all([
        fetch("/api/echeances/retards"),
        fetch("/api/suivi-revision/actions-ouvertes"),
      ])
      if (echRes.ok) setEcheances(await echRes.json())
      if (actRes.ok) setActions(await actRes.json())
    } catch { /* empty */ }
    setLoading(false)
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  // ── Stats ──

  const stats = useMemo(() => {
    const echRetard = echeances.filter((e) => calcJoursRetard(e.dateEcheance) > 0).length
    const echAVenir7j = echeances.filter((e) => { const j = calcJoursRetard(e.dateEcheance); return j <= 0 && j >= -7 }).length
    return {
      echTotal: echeances.length,
      echRetard,
      echAVenir7j,
      contacts: actions.length,
      total: echeances.length + actions.length,
    }
  }, [echeances, actions])

  // ── Show contacts view? ──

  const showContacts = filtreType === "" || filtreType === "CONTACT"
  const showEcheances = filtreType === "" || filtreType !== "CONTACT"

  // ── Filtered échéances for the grid ──

  const filteredEcheances = useMemo(() => {
    return echeances.filter((e) => {
      if (filtreType && filtreType !== "CONTACT" && e.type !== filtreType) return false
      if (filtreRetardOnly && calcJoursRetard(e.dateEcheance) < 0) return false
      return true
    })
  }, [echeances, filtreType, filtreRetardOnly])

  // ── Build dossier rows for échéances grid ──

  interface EchDossierRow {
    dossierId: string
    raisonSociale: string
    collaborateur: string
    cabinet: string
    echeances: Map<string, EcheanceRetard[]>
    maxRetard: number
  }

  const echRows = useMemo(() => {
    const dossierMap = new Map<string, EchDossierRow>()
    for (const ech of filteredEcheances) {
      const key = ech.dossier.id
      if (!dossierMap.has(key)) {
        dossierMap.set(key, {
          dossierId: ech.dossier.id,
          raisonSociale: ech.dossier.raisonSociale,
          collaborateur: ech.dossier.collaborateurPrincipal?.prenom ?? "—",
          cabinet: ech.dossier.cabinet.nom,
          echeances: new Map(),
          maxRetard: 0,
        })
      }
      const row = dossierMap.get(key)!
      const category = classifyEcheance(ech.libelle)
      if (!row.echeances.has(category)) row.echeances.set(category, [])
      row.echeances.get(category)!.push(ech)
      const j = calcJoursRetard(ech.dateEcheance)
      if (j > row.maxRetard) row.maxRetard = j
    }
    return Array.from(dossierMap.values()).sort((a, b) => b.maxRetard - a.maxRetard)
  }, [filteredEcheances])

  // ── Sorted contacts ──

  const sortedActions = useMemo(() => {
    return [...actions].sort((a, b) => calcJoursRetard(b.dateContact) - calcJoursRetard(a.dateContact))
  }, [actions])

  // ── Handlers ──

  const markEcheanceFait = useCallback(async (echeanceId: string) => {
    setEcheances((prev) => prev.filter((e) => e.id !== echeanceId))
    await fetch(`/api/echeances/${echeanceId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ statut: "FAIT" }),
    })
  }, [])

  const openClore = useCallback((action: ActionOuverte) => {
    setCloreModal({ id: action.id, sujet: action.sujet, resume: action.resume })
    setCloreReponse("")
  }, [])

  const submitClore = useCallback(async () => {
    if (!cloreModal) return
    setCloreSaving(true)
    const today = new Date().toISOString().slice(0, 10)
    setActions((prev) => prev.filter((a) => a.id !== cloreModal.id))
    await fetch("/api/suivi-revision", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: cloreModal.id, dateReponse: today, reponse: cloreReponse || null }),
    })
    setCloreSaving(false)
    setCloreModal(null)
  }, [cloreModal, cloreReponse])

  // ── Render ──

  const totalFiltered = (showEcheances && filtreType !== "CONTACT" ? filteredEcheances.length : 0)
    + (showContacts ? actions.length : 0)

  return (
    <main className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Alertes — Retards et Échéances</h1>
        <p className="mt-1 text-sm text-gray-500">
          {stats.echRetard} en retard · {stats.echAVenir7j} à venir (7j) · {stats.contacts} contact{stats.contacts > 1 ? "s" : ""} en attente
        </p>
      </div>

      {/* Stats cards */}
      <div className="mb-6 grid grid-cols-5 gap-3">
        <div className="rounded-xl border border-red-200 bg-red-50 p-4">
          <p className="text-xs font-medium text-red-600">En retard</p>
          <p className="mt-1 text-2xl font-bold text-red-700">{stats.echRetard}</p>
        </div>
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-xs font-medium text-amber-600">À venir (7j)</p>
          <p className="mt-1 text-2xl font-bold text-amber-700">{stats.echAVenir7j}</p>
        </div>
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
          <p className="text-xs font-medium text-blue-600">Échéances ouvertes</p>
          <p className="mt-1 text-2xl font-bold text-blue-700">{stats.echTotal}</p>
        </div>
        <div className="rounded-xl border border-purple-200 bg-purple-50 p-4">
          <p className="text-xs font-medium text-purple-600">Contacts en attente</p>
          <p className="mt-1 text-2xl font-bold text-purple-700">{stats.contacts}</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <p className="text-xs font-medium text-gray-500">Total alertes</p>
          <p className="mt-1 text-2xl font-bold text-gray-800">{stats.total}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <select
          value={filtreType}
          onChange={(e) => setFiltreType(e.target.value)}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
        >
          <option value="">Tous les types</option>
          <option value="FISCALE">Fiscale</option>
          <option value="SOCIALE">Sociale</option>
          <option value="JURIDIQUE">Juridique</option>
          <option value="CONTACT">Contact client</option>
        </select>

        <label className="flex items-center gap-2 text-sm text-gray-600">
          <input
            type="checkbox"
            checked={filtreRetardOnly}
            onChange={(e) => setFiltreRetardOnly(e.target.checked)}
            className="rounded border-gray-300 text-red-600 focus:ring-red-500"
          />
          Retards uniquement
        </label>

        {(filtreType || filtreRetardOnly) && (
          <button
            onClick={() => { setFiltreType(""); setFiltreRetardOnly(false) }}
            className="text-sm text-gray-500 underline hover:text-gray-700"
          >
            Réinitialiser
          </button>
        )}

        <span className="ml-auto text-xs text-gray-400">
          {totalFiltered} alerte{totalFiltered > 1 ? "s" : ""} affichée{totalFiltered > 1 ? "s" : ""}
        </span>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
        </div>
      ) : (
        <div className="space-y-6">

          {/* ── Section Contacts en attente ── */}
          {showContacts && actions.length > 0 && (
            <div>
              <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-700">
                <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-purple-100 text-[10px] font-bold text-purple-700">{actions.length}</span>
                Contacts en attente de réponse
              </h2>
              <div className="overflow-hidden rounded-xl border border-purple-200 bg-white shadow-sm">
                <table className="w-full text-xs">
                  <thead className="border-b border-purple-100 bg-purple-50/50 text-left text-[10px] font-medium uppercase tracking-wide text-purple-500">
                    <tr>
                      <th className="px-4 py-2.5">Dossier</th>
                      <th className="px-3 py-2.5">Collab.</th>
                      <th className="px-3 py-2.5">Type</th>
                      <th className="px-3 py-2.5">Sens</th>
                      <th className="px-3 py-2.5">Date</th>
                      <th className="px-3 py-2.5">Sujet</th>
                      <th className="px-3 py-2.5">Résumé</th>
                      <th className="px-3 py-2.5">Ancienneté</th>
                      <th className="px-3 py-2.5 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {sortedActions.map((a) => {
                      const jours = calcJoursRetard(a.dateContact)
                      const typeConf = ACTION_LABELS[a.statut] || ACTION_LABELS.ACTION_CABINET
                      const sensConf = SENS_LABELS[a.sens] || SENS_LABELS.SORTANT
                      return (
                        <tr key={a.id} className="hover:bg-gray-50/60">
                          <td className="px-4 py-2.5">
                            <Link href={`/dossiers/${a.dossier.id}`} className="font-medium text-gray-800 hover:text-blue-600 hover:underline">
                              {a.dossier.raisonSociale}
                            </Link>
                            <div className="text-[9px] text-gray-400">{a.dossier.cabinet.nom}</div>
                          </td>
                          <td className="px-3 py-2.5 text-gray-500">
                            {a.collaborateur?.user?.prenom ?? a.dossier.collaborateurPrincipal?.prenom ?? "—"}
                          </td>
                          <td className="px-3 py-2.5">
                            <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ${typeConf.bg} ${typeConf.text}`}>
                              {typeConf.label}
                            </span>
                          </td>
                          <td className="px-3 py-2.5">
                            <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${sensConf.bg} ${sensConf.text}`}>
                              {sensConf.icon} {sensConf.label}
                            </span>
                          </td>
                          <td className="px-3 py-2.5 text-gray-500 whitespace-nowrap">
                            {formatDate(a.dateContact)}
                          </td>
                          <td className="px-3 py-2.5 text-gray-700 max-w-[200px]">
                            {a.sujet ? (
                              <span className="font-medium">{a.sujet}</span>
                            ) : (
                              <span className="italic text-gray-300">—</span>
                            )}
                          </td>
                          <td className="px-3 py-2.5 text-gray-600 max-w-[250px]">
                            {a.resume ? (
                              <span className="line-clamp-2 text-[11px]">{a.resume}</span>
                            ) : (
                              <span className="italic text-gray-300">—</span>
                            )}
                          </td>
                          <td className="px-3 py-2.5 whitespace-nowrap">
                            <span className={`text-[10px] font-semibold ${
                              jours > 14 ? "text-red-600" : jours > 7 ? "text-amber-600" : "text-gray-500"
                            }`}>
                              {jours > 0 ? `${jours} jour${jours > 1 ? "s" : ""}` : "Aujourd\u2019hui"}
                            </span>
                          </td>
                          <td className="px-3 py-2.5 text-center">
                            <button
                              onClick={() => openClore(a)}
                              className="rounded bg-green-100 px-2.5 py-1 text-[10px] font-medium text-green-700 transition-colors hover:bg-green-200"
                            >
                              Clore
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── Section Échéances ── */}
          {showEcheances && filtreType !== "CONTACT" && (
            <div>
              {filtreType === "" && (
                <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-700">
                  <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-blue-100 text-[10px] font-bold text-blue-700">{filteredEcheances.length}</span>
                  Échéances fiscales / sociales / juridiques
                </h2>
              )}
              {echRows.length === 0 ? (
                <div className="rounded-xl bg-white p-12 text-center shadow-sm">
                  <p className="text-lg font-medium text-gray-400">Aucune échéance en attente</p>
                  <p className="mt-1 text-sm text-gray-400">
                    {filtreType || filtreRetardOnly ? "Aucun résultat avec ces filtres" : "Tous les dossiers sont à jour"}
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
                  <table className="w-full text-xs">
                    <thead className="border-b border-gray-200 text-left text-[10px] font-medium uppercase tracking-wide text-gray-400">
                      <tr>
                        <th className="sticky left-0 z-10 bg-gray-50 px-3 py-2.5">Dossier</th>
                        <th className="bg-gray-50 px-2 py-2.5">Collab.</th>
                        {OBLIGATION_COLS.map((col) => (
                          <th key={col.key} className="bg-gray-50 px-2 py-2.5 text-center">{col.label}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {echRows.map((row) => (
                        <tr key={row.dossierId} className="hover:bg-gray-50/60">
                          <td className="sticky left-0 z-10 bg-white px-3 py-2">
                            <Link
                              href={`/dossiers/${row.dossierId}`}
                              className="font-medium text-gray-800 hover:text-blue-600 hover:underline"
                            >
                              {row.raisonSociale}
                            </Link>
                            <div className="text-[9px] text-gray-400">{row.cabinet}</div>
                          </td>
                          <td className="px-2 py-2 text-gray-500">{row.collaborateur}</td>
                          {OBLIGATION_COLS.map((col) => {
                            const echs = row.echeances.get(col.key)
                            if (!echs || echs.length === 0) {
                              return (
                                <td key={col.key} className="px-2 py-2 text-center">
                                  <span className="text-gray-200">—</span>
                                </td>
                              )
                            }
                            return (
                              <td key={col.key} className="px-1 py-1.5">
                                <div className="flex flex-col gap-1">
                                  {echs.map((ech) => {
                                    const jours = calcJoursRetard(ech.dateEcheance)
                                    const isOverdue = jours > 0
                                    const isUrgent = jours >= 0 && jours <= 7
                                    return (
                                      <button
                                        key={ech.id}
                                        onClick={() => markEcheanceFait(ech.id)}
                                        title={`${ech.libelle}\n${formatDate(ech.dateEcheance)}\nCliquer pour marquer comme FAIT`}
                                        className={`group relative rounded px-1.5 py-1 text-center text-[10px] font-medium transition-all ${
                                          isOverdue
                                            ? "border border-red-200 bg-red-50 text-red-700 hover:bg-green-50 hover:text-green-700 hover:border-green-300"
                                            : isUrgent
                                              ? "border border-amber-200 bg-amber-50 text-amber-700 hover:bg-green-50 hover:text-green-700 hover:border-green-300"
                                              : "border border-blue-200 bg-blue-50 text-blue-700 hover:bg-green-50 hover:text-green-700 hover:border-green-300"
                                        }`}
                                      >
                                        <span className="group-hover:hidden">
                                          {isOverdue ? `J+${jours}` : jours === 0 ? "Auj." : `J-${Math.abs(jours)}`}
                                        </span>
                                        <span className="hidden group-hover:inline">
                                          Fait
                                        </span>
                                      </button>
                                    )
                                  })}
                                </div>
                              </td>
                            )
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Empty state when filtering contacts only and none exist */}
          {filtreType === "CONTACT" && actions.length === 0 && (
            <div className="rounded-xl bg-white p-12 text-center shadow-sm">
              <p className="text-lg font-medium text-gray-400">Aucun contact en attente</p>
              <p className="mt-1 text-sm text-gray-400">Toutes les actions ont été clôturées</p>
            </div>
          )}
        </div>
      )}

      {/* Modal: Clore une action */}
      {cloreModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">Clore l&apos;action</h3>
              <button onClick={() => setCloreModal(null)} className="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
            </div>

            {/* Recap */}
            {(cloreModal.sujet || cloreModal.resume) && (
              <div className="mb-4 rounded-lg border border-gray-200 bg-gray-50 p-3">
                {cloreModal.sujet && (
                  <p className="text-sm font-medium text-gray-700">{cloreModal.sujet}</p>
                )}
                {cloreModal.resume && (
                  <p className="mt-1 text-xs text-gray-500 whitespace-pre-wrap">{cloreModal.resume}</p>
                )}
              </div>
            )}

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Réponse donnée / action effectuée
              </label>
              <textarea
                value={cloreReponse}
                onChange={(e) => setCloreReponse(e.target.value)}
                rows={3}
                placeholder="Ex: Documents envoyés au client, Rappel effectué, Client a transmis les pièces..."
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
                autoFocus
              />
            </div>
            <div className="mt-5 flex justify-end gap-3">
              <button
                onClick={() => setCloreModal(null)}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
              >
                Annuler
              </button>
              <button
                onClick={submitClore}
                disabled={cloreSaving}
                className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
              >
                {cloreSaving ? "Enregistrement..." : "Clore l\u2019action"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
