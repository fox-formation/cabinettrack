"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import type { DossierRow, Collaborateur } from "./DossiersTabs"
import { downloadCSV } from "@/lib/exports/useExportCSV"

// ── Types ──────────────────────────────────────────────

interface SuiviRevisionEntry {
  id: string
  dossierId: string
  dateContact: string
  collaborateurId: string | null
  sens: "SORTANT" | "ENTRANT"
  sujet: string | null
  resume: string | null
  statut: "RAS" | "ACTION_CABINET" | "ACTION_CLIENT" | "DEMANDE_CLIENT" | "ACTION_REQUISE"
  prochainContact: string | null
  dateReponse: string | null
  reponse: string | null
  collaborateur: {
    user: { id: string; prenom: string; role: string }
  } | null
}

interface Props {
  dossiers: DossierRow[]
  collaborateurs: Collaborateur[]
}

// ── Helpers ────────────────────────────────────────────

const STATUT_CONFIG: Record<string, { label: string; bg: string; text: string; dot: string; alerte: boolean }> = {
  RAS:              { label: "RAS",              bg: "bg-green-100",  text: "text-green-800",  dot: "bg-green-500",  alerte: false },
  ACTION_CABINET:   { label: "Action cabinet",   bg: "bg-red-100",    text: "text-red-800",    dot: "bg-red-500",    alerte: true },
  ACTION_CLIENT:    { label: "Action client",    bg: "bg-orange-100", text: "text-orange-800", dot: "bg-orange-500", alerte: true },
  // Legacy statuts (backward compat with existing data)
  DEMANDE_CLIENT:   { label: "Action client",    bg: "bg-orange-100", text: "text-orange-800", dot: "bg-orange-500", alerte: true },
  ACTION_REQUISE:   { label: "Action cabinet",   bg: "bg-red-100",    text: "text-red-800",    dot: "bg-red-500",    alerte: true },
}

function isActionnable(statut: string): boolean {
  return STATUT_CONFIG[statut]?.alerte === true
}

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
    statut: "RAS" as "RAS" | "ACTION_CABINET" | "ACTION_CLIENT",
    prochainContact: defaultProchainContact(),
  })
  const [saving, setSaving] = useState(false)
  const [aiSuggestion, setAiSuggestion] = useState<string | null>(null)
  const [aiLoading, setAiLoading] = useState(false)

  // Clore modal state
  const [cloreModal, setCloreModal] = useState<{ entryId: string; dossierId: string; sujet: string | null } | null>(null)
  const [cloreReponse, setCloreReponse] = useState("")
  const [cloreSaving, setCloreSaving] = useState(false)

  // Edit modal state
  const [editEntry, setEditEntry] = useState<SuiviRevisionEntry | null>(null)
  const [editForm, setEditForm] = useState({ dateContact: "", sens: "SORTANT" as "SORTANT" | "ENTRANT", sujet: "", resume: "", statut: "RAS" as string, prochainContact: "" })
  const [editSaving, setEditSaving] = useState(false)

  // Delete confirmation
  const [deleteConfirm, setDeleteConfirm] = useState<{ entryId: string; dossierId: string; sujet: string | null } | null>(null)
  const [deleting, setDeleting] = useState(false)

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
        if (isActionnable(latest.statut) && !latest.dateReponse) actionsRequises++
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

  const fetchAiSuggestion = useCallback(async (resume: string) => {
    if (!modalDossierId || resume.trim().length < 10) { setAiSuggestion(null); return }
    const dossier = dossiers.find((d) => d.id === modalDossierId)
    setAiLoading(true)
    try {
      const res = await fetch("/api/ai/suggestion-echange", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resume,
          sujet: modalForm.sujet,
          sens: modalForm.sens,
          raisonSociale: dossier?.raisonSociale,
        }),
      })
      if (res.ok) {
        const data = await res.json()
        setAiSuggestion(data.suggestion)
      }
    } catch { /* silent */ }
    finally { setAiLoading(false) }
  }, [modalDossierId, modalForm.sujet, modalForm.sens, dossiers])

  // Open modal
  const openModal = (dossierId: string) => {
    setModalDossierId(dossierId)
    setModalForm({
      dateContact: new Date().toISOString().slice(0, 10),
      collaborateurId: "",
      sens: "SORTANT",
      sujet: "",
      resume: "",
      statut: "RAS" as "RAS" | "ACTION_CABINET" | "ACTION_CLIENT",
      prochainContact: defaultProchainContact(),
    })
    setAiSuggestion(null)
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

  // Open the clore modal for an actionnable entry
  const openCloreModal = useCallback((entryId: string, dossierId: string, sujet: string | null) => {
    setCloreModal({ entryId, dossierId, sujet })
    setCloreReponse("")
  }, [])

  // Submit the clore (dateReponse + reponse text)
  const submitClore = useCallback(async () => {
    if (!cloreModal) return
    setCloreSaving(true)
    const today = new Date().toISOString().slice(0, 10)
    // Optimistic update
    setSuiviParDossier((prev) => {
      const next = { ...prev }
      const entries = next[cloreModal.dossierId]
      if (entries) {
        next[cloreModal.dossierId] = entries.map((e) =>
          e.id === cloreModal.entryId ? { ...e, dateReponse: today, reponse: cloreReponse || null } : e
        )
      }
      return next
    })
    await fetch("/api/suivi-revision", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: cloreModal.entryId, dateReponse: today, reponse: cloreReponse || null }),
    })
    setCloreSaving(false)
    setCloreModal(null)
  }, [cloreModal, cloreReponse])

  // Open edit modal for an entry
  const openEditModal = useCallback((entry: SuiviRevisionEntry) => {
    setEditEntry(entry)
    setEditForm({
      dateContact: entry.dateContact.slice(0, 10),
      sens: entry.sens,
      sujet: entry.sujet || "",
      resume: entry.resume || "",
      statut: entry.statut,
      prochainContact: entry.prochainContact?.slice(0, 10) || "",
    })
  }, [])

  const submitEdit = useCallback(async () => {
    if (!editEntry) return
    setEditSaving(true)
    const res = await fetch("/api/suivi-revision", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: editEntry.id,
        dateContact: editForm.dateContact,
        sens: editForm.sens,
        sujet: editForm.sujet || null,
        resume: editForm.resume || null,
        statut: editForm.statut,
        prochainContact: editForm.prochainContact || null,
      }),
    })
    if (res.ok) {
      setEditEntry(null)
      await fetchSuivis()
    }
    setEditSaving(false)
  }, [editEntry, editForm, fetchSuivis])

  // Delete an entry
  const submitDelete = useCallback(async () => {
    if (!deleteConfirm) return
    setDeleting(true)
    await fetch("/api/suivi-revision", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: deleteConfirm.entryId }),
    })
    // Remove from local state
    setSuiviParDossier((prev) => {
      const next = { ...prev }
      const entries = next[deleteConfirm.dossierId]
      if (entries) {
        next[deleteConfirm.dossierId] = entries.filter((e) => e.id !== deleteConfirm.entryId)
      }
      return next
    })
    setDeleting(false)
    setDeleteConfirm(null)
  }, [deleteConfirm])

  // Sorted dossiers: action requise first, then retard, then rest
  const sortedDossiers = useMemo(() => {
    const now = new Date()
    now.setHours(0, 0, 0, 0)
    return [...dossiers].sort((a, b) => {
      const la = latestPerDossier[a.id]
      const lb = latestPerDossier[b.id]
      // Action requise first
      const aAction = (la && isActionnable(la.statut) && !la.dateReponse) ? 0 : 1
      const bAction = (lb && isActionnable(lb.statut) && !lb.dateReponse) ? 0 : 1
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

  const exportCSV = useCallback(() => {
    const headers = [
      "Dossier", "Collaborateur", "Clôture", "Dernier contact",
      "Sens", "Sujet", "Statut", "Prochain contact",
    ]
    const rows = sortedDossiers.map((d) => {
      const latest = latestPerDossier[d.id]
      return [
        d.raisonSociale,
        d.collaborateurPrincipal?.prenom ?? "",
        d.dateClotureExercice ? formatDate(d.dateClotureExercice) : "",
        latest ? formatDate(latest.dateContact) : "Jamais",
        latest?.sens === "ENTRANT" ? "Entrant" : latest?.sens === "SORTANT" ? "Sortant" : "",
        latest?.sujet ?? "",
        latest ? STATUT_CONFIG[latest.statut].label : "",
        latest?.prochainContact ? formatDate(latest.prochainContact) : "",
      ]
    })
    downloadCSV(`dossiers-revision-${new Date().toISOString().slice(0, 10)}.csv`, headers, rows)
  }, [sortedDossiers, latestPerDossier])

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
      {/* Export button */}
      <div className="mb-2 flex justify-end">
        <button
          onClick={exportCSV}
          className="flex items-center gap-1.5 rounded border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-50"
        >
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          Exporter CSV
        </button>
      </div>

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
                        <div className="flex items-center gap-2">
                          <span
                            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUT_CONFIG[latest.statut].bg} ${STATUT_CONFIG[latest.statut].text}`}
                          >
                            <span className={`h-1.5 w-1.5 rounded-full ${STATUT_CONFIG[latest.statut].dot}`} />
                            {STATUT_CONFIG[latest.statut].label}
                          </span>
                          {isActionnable(latest.statut) && !latest.dateReponse && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                openCloreModal(latest.id, d.id, latest.sujet)
                              }}
                              className="rounded bg-green-100 px-2 py-0.5 text-[10px] font-medium text-green-700 transition-colors hover:bg-green-200"
                              title="Clore cette action"
                            >
                              Clore
                            </button>
                          )}
                          {isActionnable(latest.statut) && latest.dateReponse && (
                            <span className="text-[10px] text-green-600">
                              Fait {formatDateShort(latest.dateReponse)}
                            </span>
                          )}
                        </div>
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
                  onBlur={() => fetchAiSuggestion(modalForm.resume)}
                  rows={3}
                  placeholder="Notes du contact..."
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                {aiLoading && (
                  <div className="mt-1.5 flex items-center gap-2 text-xs text-gray-400">
                    <svg className="h-3 w-3 animate-spin" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" /></svg>
                    Analyse en cours...
                  </div>
                )}
                {aiSuggestion && !aiLoading && (
                  <div className="mt-2 rounded-lg border border-violet-200 bg-violet-50 px-3 py-2">
                    <div className="mb-1 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-violet-600">
                      <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>
                      Pistes d'action
                    </div>
                    <div className="whitespace-pre-wrap text-xs text-violet-900">{aiSuggestion}</div>
                  </div>
                )}
              </div>

              {/* Statut */}
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Statut
                </label>
                <div className="flex gap-2">
                  {(["RAS", "ACTION_CABINET", "ACTION_CLIENT"] as const).map((s) => (
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
                {modalForm.statut === "ACTION_CABINET" && (
                  <p className="mt-1.5 text-[11px] text-red-600">Le cabinet doit agir (rappeler, préparer un doc...) — apparaitra dans les alertes</p>
                )}
                {modalForm.statut === "ACTION_CLIENT" && (
                  <p className="mt-1.5 text-[11px] text-orange-600">Le client doit nous fournir qqch / revenir vers nous — apparaitra dans les alertes</p>
                )}
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
                {cloreSaving ? "Enregistrement..." : "Clore l'action"}
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
                      {isActionnable(entry.statut) && (
                        <div className="mt-2">
                          {entry.dateReponse ? (
                            <div>
                              <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-medium text-green-700">
                                Fait le {formatDate(entry.dateReponse)}
                              </span>
                              {entry.reponse && (
                                <p className="mt-1 rounded bg-green-50 px-2 py-1 text-xs text-green-800">
                                  {entry.reponse}
                                </p>
                              )}
                            </div>
                          ) : (
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                openCloreModal(entry.id, entry.dossierId, entry.sujet)
                              }}
                              className="rounded bg-green-100 px-2.5 py-1 text-xs font-medium text-green-700 transition-colors hover:bg-green-200"
                            >
                              Clore cette action
                            </button>
                          )}
                        </div>
                      )}
                      {/* Edit / Delete */}
                      <div className="mt-3 flex items-center gap-2 border-t border-gray-100 pt-2">
                        <button
                          onClick={(e) => { e.stopPropagation(); openEditModal(entry) }}
                          className="text-[10px] font-medium text-blue-600 hover:text-blue-800 hover:underline"
                        >
                          Modifier
                        </button>
                        <span className="text-gray-300">|</span>
                        <button
                          onClick={(e) => { e.stopPropagation(); setDeleteConfirm({ entryId: entry.id, dossierId: entry.dossierId, sujet: entry.sujet }) }}
                          className="text-[10px] font-medium text-red-500 hover:text-red-700 hover:underline"
                        >
                          Supprimer
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      {/* Modal: Modifier un contact */}
      {editEntry && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">Modifier le contact</h3>
              <button onClick={() => setEditEntry(null)} className="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Date du contact</label>
                  <input type="date" value={editForm.dateContact} onChange={(e) => setEditForm({ ...editForm, dateContact: e.target.value })} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none" />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Sens</label>
                  <div className="flex gap-2">
                    {(["SORTANT", "ENTRANT"] as const).map((s) => (
                      <button key={s} type="button" onClick={() => setEditForm({ ...editForm, sens: s })} className={`flex-1 rounded-lg px-3 py-2 text-xs font-medium transition-colors ${editForm.sens === s ? (s === "SORTANT" ? "bg-blue-100 text-blue-800 ring-2 ring-blue-300" : "bg-green-100 text-green-800 ring-2 ring-green-300") : "bg-gray-100 text-gray-500 hover:bg-gray-200"}`}>
                        {s === "SORTANT" ? "↗ Sortant" : "↙ Entrant"}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Sujet</label>
                <input type="text" value={editForm.sujet} onChange={(e) => setEditForm({ ...editForm, sujet: e.target.value })} placeholder="Ex: Demande de documents..." className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none" />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Résumé</label>
                <textarea value={editForm.resume} onChange={(e) => setEditForm({ ...editForm, resume: e.target.value })} rows={3} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none" />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Statut</label>
                <div className="flex gap-2">
                  {(["RAS", "ACTION_CABINET", "ACTION_CLIENT"] as const).map((s) => (
                    <button key={s} type="button" onClick={() => setEditForm({ ...editForm, statut: s })} className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${editForm.statut === s ? `${STATUT_CONFIG[s].bg} ${STATUT_CONFIG[s].text} ring-2 ring-offset-1 ring-gray-300` : "bg-gray-100 text-gray-500 hover:bg-gray-200"}`}>
                      {STATUT_CONFIG[s].label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Prochain contact</label>
                <input type="date" value={editForm.prochainContact} onChange={(e) => setEditForm({ ...editForm, prochainContact: e.target.value })} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none" />
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button onClick={() => setEditEntry(null)} className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">Annuler</button>
              <button onClick={submitEdit} disabled={editSaving} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
                {editSaving ? "Enregistrement..." : "Enregistrer"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Confirmation suppression */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-2 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100">
                <svg className="h-5 w-5 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900">Supprimer ce contact ?</h3>
            </div>
            {deleteConfirm.sujet && (
              <p className="mb-3 ml-[52px] text-sm text-gray-500">{deleteConfirm.sujet}</p>
            )}
            <p className="ml-[52px] text-sm text-gray-500">Cette action est irréversible.</p>
            <div className="mt-5 flex justify-end gap-3">
              <button onClick={() => setDeleteConfirm(null)} className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">Annuler</button>
              <button onClick={submitDelete} disabled={deleting} className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50">
                {deleting ? "Suppression..." : "Supprimer"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
