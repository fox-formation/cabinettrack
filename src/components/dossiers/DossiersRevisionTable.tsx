"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import type { DossierRow, Collaborateur } from "./DossiersTabs"

// ── Types ──────────────────────────────────────────────

interface SuiviRevisionEntry {
  id: string
  dossierId: string
  dateContact: string
  collaborateurId: string | null
  sens: "SORTANT" | "ENTRANT"
  sujet: string | null
  resume: string | null
  statut: "RAS" | "DEMANDE_CLIENT" | "ACTION_REQUISE"
  prochainContact: string | null
  collaborateur: {
    user: { id: string; prenom: string; role: string }
  } | null
}

interface Props {
  dossiers: DossierRow[]
  collaborateurs: Collaborateur[]
}

// ── Helpers ────────────────────────────────────────────

const STATUT_CONFIG = {
  RAS: { label: "RAS", bg: "bg-green-100", text: "text-green-800", dot: "bg-green-500" },
  DEMANDE_CLIENT: { label: "Demande client", bg: "bg-orange-100", text: "text-orange-800", dot: "bg-orange-500" },
  ACTION_REQUISE: { label: "Action requise", bg: "bg-red-100", text: "text-red-800", dot: "bg-red-500" },
} as const

function formatDate(iso: string | null): string {
  if (!iso) return "—"
  const d = new Date(iso)
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" })
}

function formatDateShort(iso: string | null): string {
  if (!iso) return "—"
  const d = new Date(iso)
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" })
}

function daysUntil(iso: string | null): number | null {
  if (!iso) return null
  const target = new Date(iso)
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  target.setHours(0, 0, 0, 0)
  return Math.floor((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
}

function defaultProchainContact(): string {
  const d = new Date()
  d.setMonth(d.getMonth() + 3)
  return d.toISOString().slice(0, 10)
}

// ── Component ──────────────────────────────────────────

export default function DossiersRevisionTable({ dossiers, collaborateurs }: Props) {
  // State: suivi data per dossier
  const [suiviParDossier, setSuiviParDossier] = useState<Record<string, SuiviRevisionEntry[]>>({})
  const [loading, setLoading] = useState(true)

  // Modal state
  const [showModal, setShowModal] = useState(false)
  const [modalDossierId, setModalDossierId] = useState<string | null>(null)
  const [modalForm, setModalForm] = useState({
    dateContact: new Date().toISOString().slice(0, 10),
    collaborateurId: "",
    sens: "SORTANT" as "SORTANT" | "ENTRANT",
    sujet: "",
    resume: "",
    statut: "RAS" as "RAS" | "DEMANDE_CLIENT" | "ACTION_REQUISE",
    prochainContact: defaultProchainContact(),
  })
  const [saving, setSaving] = useState(false)

  // Panel state (historique)
  const [panelDossierId, setPanelDossierId] = useState<string | null>(null)

  // Fetch all suivi data
  const dossierIds = useMemo(() => dossiers.map((d) => d.id), [dossiers])

  const fetchSuivis = useCallback(async () => {
    if (dossierIds.length === 0) {
      setSuiviParDossier({})
      setLoading(false)
      return
    }
    try {
      const res = await fetch(`/api/suivi-revision?dossierIds=${dossierIds.join(",")}`)
      if (res.ok) {
        const data = await res.json()
        setSuiviParDossier(data)
      }
    } catch {
      // silent
    } finally {
      setLoading(false)
    }
  }, [dossierIds])

  useEffect(() => {
    fetchSuivis()
  }, [fetchSuivis])

  // Derived: latest entry per dossier
  const latestPerDossier = useMemo(() => {
    const map: Record<string, SuiviRevisionEntry | null> = {}
    for (const d of dossiers) {
      const entries = suiviParDossier[d.id]
      map[d.id] = entries && entries.length > 0 ? entries[0] : null // already sorted desc
    }
    return map
  }, [dossiers, suiviParDossier])

  // Stats
  const stats = useMemo(() => {
    const now = new Date()
    now.setHours(0, 0, 0, 0)
    let contactEnRetard = 0
    let actionsRequises = 0

    for (const d of dossiers) {
      const latest = latestPerDossier[d.id]
      if (latest) {
        if (latest.statut === "ACTION_REQUISE") actionsRequises++
        if (latest.prochainContact) {
          const pc = new Date(latest.prochainContact)
          pc.setHours(0, 0, 0, 0)
          if (pc < now) contactEnRetard++
        }
      } else {
        // No contact ever = en retard
        contactEnRetard++
      }
    }

    return { total: dossiers.length, contactEnRetard, actionsRequises }
  }, [dossiers, latestPerDossier])

  // Open modal
  const openModal = (dossierId: string) => {
    setModalDossierId(dossierId)
    setModalForm({
      dateContact: new Date().toISOString().slice(0, 10),
      collaborateurId: "",
      sens: "SORTANT",
      sujet: "",
      resume: "",
      statut: "RAS",
      prochainContact: defaultProchainContact(),
    })
    setShowModal(true)
  }

  // Submit new contact
  const handleSubmit = async () => {
    if (!modalDossierId) return
    setSaving(true)
    try {
      const res = await fetch("/api/suivi-revision", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dossierId: modalDossierId,
          dateContact: modalForm.dateContact,
          collaborateurId: modalForm.collaborateurId || null,
          sens: modalForm.sens,
          sujet: modalForm.sujet || null,
          resume: modalForm.resume || null,
          statut: modalForm.statut,
          prochainContact: modalForm.prochainContact || null,
        }),
      })
      if (res.ok) {
        setShowModal(false)
        await fetchSuivis()
      } else {
        const err = await res.json().catch(() => null)
        alert(`Erreur lors de l'enregistrement : ${err?.error ?? res.statusText}`)
      }
    } catch (e) {
      alert(`Erreur réseau : ${e instanceof Error ? e.message : "inconnue"}`)
    } finally {
      setSaving(false)
    }
  }

  // Sorted dossiers: action requise first, then retard, then rest
  const sortedDossiers = useMemo(() => {
    const now = new Date()
    now.setHours(0, 0, 0, 0)
    return [...dossiers].sort((a, b) => {
      const la = latestPerDossier[a.id]
      const lb = latestPerDossier[b.id]
      // Action requise first
      const aAction = la?.statut === "ACTION_REQUISE" ? 0 : 1
      const bAction = lb?.statut === "ACTION_REQUISE" ? 0 : 1
      if (aAction !== bAction) return aAction - bAction
      // Then retard
      const aRetard = !la || (la.prochainContact && new Date(la.prochainContact) < now) ? 0 : 1
      const bRetard = !lb || (lb.prochainContact && new Date(lb.prochainContact) < now) ? 0 : 1
      if (aRetard !== bRetard) return aRetard - bRetard
      // Alphabetical
      return a.raisonSociale.localeCompare(b.raisonSociale)
    })
  }, [dossiers, latestPerDossier])

  // Panel dossier name
  const panelDossier = dossiers.find((d) => d.id === panelDossierId)
  const panelEntries = panelDossierId ? (suiviParDossier[panelDossierId] || []) : []

  if (dossiers.length === 0) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-12 text-center">
        <p className="text-gray-500">Aucun dossier en révision annuelle.</p>
        <p className="mt-1 text-sm text-gray-400">
          Les dossiers avec type de mission &quot;Révision&quot; apparaîtront ici.
        </p>
      </div>
    )
  }

  return (
    <div>
      {/* Stats cards */}
      <div className="mb-4 grid grid-cols-3 gap-4">
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <p className="text-sm text-gray-500">Total révision</p>
          <p className="mt-1 text-2xl font-bold text-gray-900">{stats.total}</p>
        </div>
        <div className="rounded-lg border border-orange-200 bg-orange-50 p-4">
          <p className="text-sm text-orange-600">Contact en retard</p>
          <p className="mt-1 text-2xl font-bold text-orange-700">{stats.contactEnRetard}</p>
        </div>
        <div className="rounded-lg border border-red-200 bg-red-50 p-4">
          <p className="text-sm text-red-600">Actions requises</p>
          <p className="mt-1 text-2xl font-bold text-red-700">{stats.actionsRequises}</p>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b bg-gray-50 text-xs font-medium uppercase text-gray-500">
              <th className="px-4 py-3">Dossier</th>
              <th className="px-4 py-3">Collaborateur</th>
              <th className="px-4 py-3">Clôture</th>
              <th className="px-4 py-3">Dernier contact</th>
              <th className="px-4 py-3">Statut</th>
              <th className="px-4 py-3">Prochain contact</th>
              <th className="px-4 py-3 text-center">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-gray-400">
                  Chargement...
                </td>
              </tr>
            ) : (
              sortedDossiers.map((d) => {
                const latest = latestPerDossier[d.id]
                const days = daysUntil(latest?.prochainContact ?? null)
                const isOverdue = days !== null && days < 0
                const isSoon = days !== null && days >= 0 && days <= 7
                const neverContacted = !latest

                return (
                  <tr
                    key={d.id}
                    className="border-b hover:bg-gray-50 cursor-pointer"
                    onClick={() => setPanelDossierId(d.id)}
                  >
                    <td className="px-4 py-3 font-medium text-gray-900">
                      {d.raisonSociale}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {d.collaborateurPrincipal?.prenom ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {d.dateClotureExercice
                        ? formatDate(d.dateClotureExercice)
                        : "—"}
                    </td>
                    <td className="px-4 py-3">
                      {neverContacted ? (
                        <span className="text-gray-400 italic">Jamais contacté</span>
                      ) : (
                        <span className="text-gray-700">{formatDate(latest.dateContact)}</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {latest ? (
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUT_CONFIG[latest.statut].bg} ${STATUT_CONFIG[latest.statut].text}`}
                        >
                          <span className={`h-1.5 w-1.5 rounded-full ${STATUT_CONFIG[latest.statut].dot}`} />
                          {STATUT_CONFIG[latest.statut].label}
                        </span>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {neverContacted ? (
                        <span className="rounded bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-700">
                          Aucun
                        </span>
                      ) : isOverdue ? (
                        <span className="rounded bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
                          {formatDateShort(latest.prochainContact)} ({Math.abs(days!)}j retard)
                        </span>
                      ) : isSoon ? (
                        <span className="rounded bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                          {formatDateShort(latest.prochainContact)} (J-{days})
                        </span>
                      ) : latest.prochainContact ? (
                        <span className="text-gray-600">
                          {formatDate(latest.prochainContact)}
                        </span>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          openModal(d.id)
                        }}
                        className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-gray-300 bg-white text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                        title="Nouveau contact"
                      >
                        +
                      </button>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Modal: Nouveau contact */}
      {showModal && modalDossierId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div
            className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">
                Nouveau contact
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                &times;
              </button>
            </div>
            <p className="mb-4 text-sm text-gray-500">
              {dossiers.find((d) => d.id === modalDossierId)?.raisonSociale}
            </p>

            <div className="space-y-4">
              {/* Date contact */}
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Date du contact
                </label>
                <input
                  type="date"
                  value={modalForm.dateContact}
                  onChange={(e) => setModalForm({ ...modalForm, dateContact: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              {/* Collaborateur */}
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Collaborateur qui a appelé
                </label>
                <select
                  value={modalForm.collaborateurId}
                  onChange={(e) => setModalForm({ ...modalForm, collaborateurId: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                >
                  <option value="">— Sélectionner —</option>
                  {collaborateurs.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.prenom}
                    </option>
                  ))}
                </select>
              </div>

              {/* Sens du contact */}
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Sens du contact
                </label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setModalForm({ ...modalForm, sens: "SORTANT" })}
                    className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                      modalForm.sens === "SORTANT"
                        ? "bg-blue-100 text-blue-800 ring-2 ring-blue-300"
                        : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                    }`}
                  >
                    <span>&#8599;</span> Nous avons appelé
                  </button>
                  <button
                    type="button"
                    onClick={() => setModalForm({ ...modalForm, sens: "ENTRANT" })}
                    className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                      modalForm.sens === "ENTRANT"
                        ? "bg-green-100 text-green-800 ring-2 ring-green-300"
                        : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                    }`}
                  >
                    <span>&#8601;</span> Le client nous a contacté
                  </button>
                </div>
              </div>

              {/* Sujet */}
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Sujet
                </label>
                <input
                  type="text"
                  value={modalForm.sujet}
                  onChange={(e) => setModalForm({ ...modalForm, sujet: e.target.value })}
                  placeholder="Ex: Demande de documents, Relance TVA..."
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              {/* Résumé */}
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Résumé
                </label>
                <textarea
                  value={modalForm.resume}
                  onChange={(e) => setModalForm({ ...modalForm, resume: e.target.value })}
                  rows={3}
                  placeholder="Notes du contact..."
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              {/* Statut */}
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Statut
                </label>
                <div className="flex gap-2">
                  {(["RAS", "DEMANDE_CLIENT", "ACTION_REQUISE"] as const).map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setModalForm({ ...modalForm, statut: s })}
                      className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                        modalForm.statut === s
                          ? `${STATUT_CONFIG[s].bg} ${STATUT_CONFIG[s].text} ring-2 ring-offset-1 ring-gray-300`
                          : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                      }`}
                    >
                      {STATUT_CONFIG[s].label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Prochain contact */}
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Prochain contact prévu
                </label>
                <input
                  type="date"
                  value={modalForm.prochainContact}
                  onChange={(e) => setModalForm({ ...modalForm, prochainContact: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setShowModal(false)}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
              >
                Annuler
              </button>
              <button
                onClick={handleSubmit}
                disabled={saving}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? "Enregistrement..." : "Enregistrer"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Panel latéral: Historique */}
      {panelDossierId && (
        <div className="fixed inset-0 z-40 flex justify-end">
          <div
            className="flex-1 bg-black/20"
            onClick={() => setPanelDossierId(null)}
          />
          <div className="h-full w-full max-w-md overflow-y-auto border-l bg-white shadow-xl">
            <div className="sticky top-0 border-b bg-white px-6 py-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">
                    {panelDossier?.raisonSociale}
                  </h3>
                  <p className="text-sm text-gray-500">Historique des contacts</p>
                </div>
                <button
                  onClick={() => setPanelDossierId(null)}
                  className="text-gray-400 hover:text-gray-600 text-xl"
                >
                  &times;
                </button>
              </div>
            </div>

            <div className="p-6">
              {panelEntries.length === 0 ? (
                <div className="py-8 text-center">
                  <p className="text-gray-400">Aucun contact enregistré</p>
                  <button
                    onClick={() => {
                      setPanelDossierId(null)
                      openModal(panelDossierId)
                    }}
                    className="mt-3 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                  >
                    Ajouter un contact
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {panelEntries.map((entry) => (
                    <div
                      key={entry.id}
                      className="rounded-lg border border-gray-200 p-4"
                    >
                      <div className="mb-2 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-gray-900">
                            {formatDate(entry.dateContact)}
                          </span>
                          <span
                            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${
                              entry.sens === "ENTRANT"
                                ? "bg-green-100 text-green-700"
                                : "bg-blue-100 text-blue-700"
                            }`}
                          >
                            {entry.sens === "ENTRANT" ? "↙ Entrant" : "↗ Sortant"}
                          </span>
                        </div>
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${STATUT_CONFIG[entry.statut].bg} ${STATUT_CONFIG[entry.statut].text}`}
                        >
                          <span className={`h-1.5 w-1.5 rounded-full ${STATUT_CONFIG[entry.statut].dot}`} />
                          {STATUT_CONFIG[entry.statut].label}
                        </span>
                      </div>
                      {entry.sujet && (
                        <p className="text-sm font-medium text-gray-800">
                          {entry.sujet}
                        </p>
                      )}
                      {entry.collaborateur?.user && (
                        <p className="text-xs text-gray-500">
                          Par {entry.collaborateur.user.prenom}
                        </p>
                      )}
                      {entry.resume && (
                        <p className="mt-2 text-sm text-gray-700 whitespace-pre-wrap">
                          {entry.resume}
                        </p>
                      )}
                      {entry.prochainContact && (
                        <p className="mt-2 text-xs text-gray-400">
                          Prochain contact : {formatDate(entry.prochainContact)}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
