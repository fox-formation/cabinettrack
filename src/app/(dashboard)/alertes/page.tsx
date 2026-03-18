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

// ── Unified alert item ─────────────────────────────────

type AlerteType = "FISCALE" | "SOCIALE" | "JURIDIQUE" | "CONTACT"

interface AlerteUnifiee {
  id: string
  type: AlerteType
  dossierId: string
  raisonSociale: string
  collaborateur: string
  cabinet: string
  libelle: string
  dateRef: string        // date échéance ou date contact
  joursRetard: number    // positif = en retard, négatif = à venir
  source: "echeance" | "action"
  sousType?: string      // "Cabinet" ou "Client" pour les contacts
  sujet?: string | null
  echeanceId?: string
  actionId?: string
}

// ── Config ─────────────────────────────────────────────

const ACTION_SOUS_TYPES: Record<string, string> = {
  ACTION_CABINET: "Action cabinet",
  ACTION_CLIENT: "Action client",
  ACTION_REQUISE: "Action cabinet",
  DEMANDE_CLIENT: "Action client",
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
  { key: "CONTACT", label: "Contact", match: () => false },
  { key: "AUTRE", label: "Autres", match: () => true },
] as const

function classifyEcheance(libelle: string): string {
  for (const col of OBLIGATION_COLS) {
    if (col.key !== "AUTRE" && col.key !== "CONTACT" && col.match(libelle)) return col.key
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

// ── Component ──────────────────────────────────────────

export default function AlertesPage() {
  const [echeances, setEcheances] = useState<EcheanceRetard[]>([])
  const [actions, setActions] = useState<ActionOuverte[]>([])
  const [loading, setLoading] = useState(true)
  const [filtreType, setFiltreType] = useState<string>("")
  const [filtreRetardOnly, setFiltreRetardOnly] = useState(false)

  // Clore modal
  const [cloreModal, setCloreModal] = useState<{ id: string; sujet: string | null } | null>(null)
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

  // ── Unified alertes list ──

  const alertes = useMemo<AlerteUnifiee[]>(() => {
    const list: AlerteUnifiee[] = []

    // Échéances
    for (const ech of echeances) {
      list.push({
        id: `ech-${ech.id}`,
        type: ech.type as AlerteType,
        dossierId: ech.dossier.id,
        raisonSociale: ech.dossier.raisonSociale,
        collaborateur: ech.dossier.collaborateurPrincipal?.prenom ?? "—",
        cabinet: ech.dossier.cabinet.nom,
        libelle: ech.libelle,
        dateRef: ech.dateEcheance,
        joursRetard: calcJoursRetard(ech.dateEcheance),
        source: "echeance",
        echeanceId: ech.id,
      })
    }

    // Actions contacts
    for (const a of actions) {
      list.push({
        id: `act-${a.id}`,
        type: "CONTACT",
        dossierId: a.dossier.id,
        raisonSociale: a.dossier.raisonSociale,
        collaborateur: a.dossier.collaborateurPrincipal?.prenom ?? "—",
        cabinet: a.dossier.cabinet.nom,
        libelle: a.sujet || "Contact en attente",
        dateRef: a.dateContact,
        joursRetard: calcJoursRetard(a.dateContact),
        source: "action",
        sousType: ACTION_SOUS_TYPES[a.statut] || "Action",
        sujet: a.sujet,
        actionId: a.id,
      })
    }

    return list
  }, [echeances, actions])

  // ── Filtered alertes ──

  const filtered = useMemo(() => {
    return alertes.filter((a) => {
      if (filtreType && a.type !== filtreType) return false
      if (filtreRetardOnly && a.joursRetard < 0) return false
      return true
    })
  }, [alertes, filtreType, filtreRetardOnly])

  // ── Stats ──

  const stats = useMemo(() => {
    const enRetard = alertes.filter((a) => a.joursRetard > 0).length
    const aVenir = alertes.filter((a) => a.joursRetard <= 0).length
    const aVenir7j = alertes.filter((a) => a.joursRetard <= 0 && a.joursRetard >= -7).length
    const contacts = alertes.filter((a) => a.type === "CONTACT").length
    return { total: alertes.length, enRetard, aVenir, aVenir7j, contacts }
  }, [alertes])

  // ── Build dossier-grouped rows for the table ──

  interface DossierRow {
    dossierId: string
    raisonSociale: string
    collaborateur: string
    cabinet: string
    cellules: Map<string, AlerteUnifiee[]>
    maxRetard: number
  }

  const { rows } = useMemo(() => {
    const dossierMap = new Map<string, DossierRow>()

    for (const a of filtered) {
      const key = a.dossierId
      if (!dossierMap.has(key)) {
        dossierMap.set(key, {
          dossierId: a.dossierId,
          raisonSociale: a.raisonSociale,
          collaborateur: a.collaborateur,
          cabinet: a.cabinet,
          cellules: new Map(),
          maxRetard: 0,
        })
      }
      const row = dossierMap.get(key)!

      // Classify into column
      let colKey: string
      if (a.type === "CONTACT") {
        colKey = "CONTACT"
      } else {
        colKey = classifyEcheance(a.libelle)
      }

      if (!row.cellules.has(colKey)) row.cellules.set(colKey, [])
      row.cellules.get(colKey)!.push(a)
      if (a.joursRetard > row.maxRetard) row.maxRetard = a.joursRetard
    }

    const sorted = Array.from(dossierMap.values()).sort((a, b) => b.maxRetard - a.maxRetard)
    return { rows: sorted }
  }, [filtered])

  // ── Actions ──

  const markEcheanceFait = useCallback(async (echeanceId: string, alerteId: string) => {
    setEcheances((prev) => prev.filter((e) => e.id !== echeanceId))
    await fetch(`/api/echeances/${echeanceId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ statut: "FAIT" }),
    })
  }, [])

  const openClore = useCallback((actionId: string, sujet: string | null) => {
    setCloreModal({ id: actionId, sujet })
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

  return (
    <main className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Alertes — Retards et Échéances</h1>
        <p className="mt-1 text-sm text-gray-500">
          {stats.enRetard} en retard · {stats.aVenir} à venir · {stats.contacts} contact{stats.contacts > 1 ? "s" : ""} en attente · {rows.length} dossier{rows.length > 1 ? "s" : ""} concerné{rows.length > 1 ? "s" : ""}
        </p>
      </div>

      {/* Stats cards */}
      <div className="mb-6 grid grid-cols-5 gap-3">
        <div className="rounded-xl border border-red-200 bg-red-50 p-4">
          <p className="text-xs font-medium text-red-600">En retard</p>
          <p className="mt-1 text-2xl font-bold text-red-700">{stats.enRetard}</p>
        </div>
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-xs font-medium text-amber-600">À venir (7j)</p>
          <p className="mt-1 text-2xl font-bold text-amber-700">{stats.aVenir7j}</p>
        </div>
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
          <p className="text-xs font-medium text-blue-600">Échéances ouvertes</p>
          <p className="mt-1 text-2xl font-bold text-blue-700">{echeances.length}</p>
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
          {filtered.length} alerte{filtered.length > 1 ? "s" : ""} affichée{filtered.length > 1 ? "s" : ""}
        </span>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-xl bg-white p-12 text-center shadow-sm">
          <p className="text-lg font-medium text-gray-400">Aucune alerte</p>
          <p className="mt-1 text-sm text-gray-400">
            {filtreType || filtreRetardOnly
              ? "Aucun résultat avec ces filtres"
              : "Tous les dossiers sont à jour"}
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
              {rows.map((row) => (
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
                    const items = row.cellules.get(col.key)
                    if (!items || items.length === 0) {
                      return (
                        <td key={col.key} className="px-2 py-2 text-center">
                          <span className="text-gray-200">—</span>
                        </td>
                      )
                    }
                    return (
                      <td key={col.key} className="px-1 py-1.5">
                        <div className="flex flex-col gap-1">
                          {items.map((item) => {
                            const isOverdue = item.joursRetard > 0
                            const isUrgent = item.joursRetard >= 0 && item.joursRetard <= 7

                            if (item.source === "action") {
                              // Contact action — purple style with Clore
                              return (
                                <button
                                  key={item.id}
                                  onClick={() => openClore(item.actionId!, item.sujet ?? null)}
                                  title={`${item.sousType}: ${item.libelle}\n${new Date(item.dateRef).toLocaleDateString("fr-FR")}\nCliquer pour clore`}
                                  className={`group relative rounded px-1.5 py-1 text-center text-[10px] font-medium transition-all ${
                                    isOverdue
                                      ? "border border-purple-300 bg-purple-100 text-purple-800 hover:bg-green-50 hover:text-green-700 hover:border-green-300"
                                      : "border border-purple-200 bg-purple-50 text-purple-700 hover:bg-green-50 hover:text-green-700 hover:border-green-300"
                                  }`}
                                >
                                  <span className="group-hover:hidden">
                                    {item.sousType === "Action client" ? "Cli" : "Cab"} {isOverdue ? `+${item.joursRetard}j` : "Auj."}
                                  </span>
                                  <span className="hidden group-hover:inline">
                                    Clore
                                  </span>
                                </button>
                              )
                            }

                            // Échéance — standard style
                            return (
                              <button
                                key={item.id}
                                onClick={() => markEcheanceFait(item.echeanceId!, item.id)}
                                title={`${item.libelle}\n${new Date(item.dateRef).toLocaleDateString("fr-FR")}\nCliquer pour marquer comme FAIT`}
                                className={`group relative rounded px-1.5 py-1 text-center text-[10px] font-medium transition-all ${
                                  isOverdue
                                    ? "border border-red-200 bg-red-50 text-red-700 hover:bg-green-50 hover:text-green-700 hover:border-green-300"
                                    : isUrgent
                                      ? "border border-amber-200 bg-amber-50 text-amber-700 hover:bg-green-50 hover:text-green-700 hover:border-green-300"
                                      : "border border-blue-200 bg-blue-50 text-blue-700 hover:bg-green-50 hover:text-green-700 hover:border-green-300"
                                }`}
                              >
                                <span className="group-hover:hidden">
                                  {isOverdue ? `J+${item.joursRetard}` : item.joursRetard === 0 ? "Auj." : `J-${Math.abs(item.joursRetard)}`}
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

      {/* Modal: Clore une action */}
      {cloreModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">Clore l&apos;action</h3>
              <button onClick={() => setCloreModal(null)} className="text-gray-400 hover:text-gray-600">&times;</button>
            </div>
            {cloreModal.sujet && (
              <p className="mb-3 text-sm text-gray-500">Sujet : {cloreModal.sujet}</p>
            )}
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Réponse donnée / action effectuée
              </label>
              <textarea
                value={cloreReponse}
                onChange={(e) => setCloreReponse(e.target.value)}
                rows={3}
                placeholder="Ex: Documents envoyés, Client a rappelé, Dossier transmis..."
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
