"use client"

import { useState, useCallback, useEffect, useRef } from "react"
import { useSession } from "next-auth/react"
import Link from "next/link"
import EtatPanel from "./EtatPanel"
import NotesModal from "./NotesModal"
import { ETAPES_BILAN } from "@/lib/dossiers/avancement"

function prefixComment(text: string, numero: string | null): string {
  if (!text.trim()) return ""
  const now = new Date()
  const dd = String(now.getDate()).padStart(2, "0")
  const mm = String(now.getMonth() + 1).padStart(2, "0")
  const yy = String(now.getFullYear()).slice(-2)
  const tag = numero || "??"
  return `[${tag} ${dd}.${mm}.${yy}] ${text.trim()}`
}

interface DossierRow {
  id: string
  raisonSociale: string
  collaborateurPrincipal: { id: string; prenom: string; role: string } | null
  firstAssistant: { prenom: string } | null
  datePrevueArreteBilan: string | null
  dateClotureExercice: string | null
  avancement: number
  etapeStatuts: (string | null)[]
  commentaireBilan: string | null
}

interface CollabOption {
  id: string
  prenom: string
  role: string
}

interface DossiersTableProps {
  dossiers: DossierRow[]
  collaborateurs?: CollabOption[]
}

const ROLE_SHORT: Record<string, string> = {
  ASSISTANT: "Asst",
  CONFIRME: "Conf",
  SUPERVISEUR: "Sup",
  EXPERT_COMPTABLE: "EC",
}

export default function DossiersTable({ dossiers: initialDossiers, collaborateurs = [] }: DossiersTableProps) {
  const { data: session } = useSession()
  const userNumero = (session?.user as Record<string, unknown> | undefined)?.numero as string | null ?? null
  const [panelDossierId, setPanelDossierId] = useState<string | null>(null)
  const [notesDossierId, setNotesDossierId] = useState<string | null>(null)
  const [dossiers, setDossiers] = useState(initialDossiers)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [bulkComment, setBulkComment] = useState("")
  const [showBulkComment, setShowBulkComment] = useState(false)
  const [focusedRow, setFocusedRow] = useState(-1)
  const [focusedEtape, setFocusedEtape] = useState(0)
  const tableRef = useRef<HTMLTableElement>(null)
  const now = new Date()

  // ── Exchange modal state ──
  const [exchangeModal, setExchangeModal] = useState<{ dossierId: string; raisonSociale: string } | null>(null)
  const [exchangeForm, setExchangeForm] = useState({
    dateContact: new Date().toISOString().slice(0, 10),
    collaborateurId: "",
    sens: "SORTANT" as "SORTANT" | "ENTRANT",
    sujet: "",
    resume: "",
    statut: "RAS" as "RAS" | "DEMANDE_CLIENT" | "ACTION_REQUISE",
    prochainContact: "",
  })
  const [exchangeSaving, setExchangeSaving] = useState(false)

  const openExchangeModal = useCallback((dossierId: string, raisonSociale: string) => {
    setExchangeForm({
      dateContact: new Date().toISOString().slice(0, 10),
      collaborateurId: "",
      sens: "SORTANT",
      sujet: "",
      resume: "",
      statut: "RAS",
      prochainContact: "",
    })
    setExchangeModal({ dossierId, raisonSociale })
  }, [])

  const submitExchange = useCallback(async () => {
    if (!exchangeModal) return
    setExchangeSaving(true)
    try {
      const res = await fetch("/api/suivi-revision", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dossierId: exchangeModal.dossierId,
          dateContact: exchangeForm.dateContact,
          collaborateurId: exchangeForm.collaborateurId || null,
          sens: exchangeForm.sens,
          sujet: exchangeForm.sujet || null,
          resume: exchangeForm.resume || null,
          statut: exchangeForm.statut,
          prochainContact: exchangeForm.prochainContact || null,
        }),
      })
      if (res.ok) {
        setExchangeModal(null)
      } else {
        const err = await res.json().catch(() => null)
        alert(`Erreur : ${err?.error ?? res.statusText}`)
      }
    } catch (e) {
      alert(`Erreur réseau : ${e instanceof Error ? e.message : "inconnue"}`)
    } finally {
      setExchangeSaving(false)
    }
  }, [exchangeModal, exchangeForm])

  // ── Batch save: accumulate étape changes, flush in one PATCH per dossier ──
  const pendingRef = useRef<Record<string, Record<string, string | null>>>({})
  const timersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({})

  const flushDossier = useCallback((dossierId: string) => {
    const changes = pendingRef.current[dossierId]
    if (!changes || Object.keys(changes).length === 0) return
    const body = { ...changes }
    delete pendingRef.current[dossierId]
    delete timersRef.current[dossierId]
    fetch(`/api/dossiers/${dossierId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
  }, [])

  const queueStatutPatch = useCallback((dossierId: string, cle: string, value: string | null) => {
    if (!pendingRef.current[dossierId]) pendingRef.current[dossierId] = {}
    pendingRef.current[dossierId][cle] = value
    // Reset the debounce timer for this dossier
    if (timersRef.current[dossierId]) clearTimeout(timersRef.current[dossierId])
    timersRef.current[dossierId] = setTimeout(() => flushDossier(dossierId), 2000)
  }, [flushDossier])

  // Flush all pending on unmount or page leave
  useEffect(() => {
    const flushAll = () => {
      for (const id of Object.keys(pendingRef.current)) {
        if (timersRef.current[id]) clearTimeout(timersRef.current[id])
        flushDossier(id)
      }
    }
    window.addEventListener("beforeunload", flushAll)
    return () => {
      window.removeEventListener("beforeunload", flushAll)
      flushAll()
    }
  }, [flushDossier])

  // ── Keyboard navigation ──
  // Clickable étape indices (skip hasNote)
  const clickableEtapes = useRef(
    ETAPES_BILAN.map((e, i) => ({ index: i, hasNote: e.hasNote })).filter((e) => !e.hasNote).map((e) => e.index)
  )

  useEffect(() => {
    setDossiers(initialDossiers)
  }, [initialDossiers])

  const handleAvancementChange = useCallback((dossierId: string, newAvancement: number) => {
    setDossiers((prev) =>
      prev.map((d) => (d.id === dossierId ? { ...d, avancement: newAvancement } : d))
    )
  }, [])

  const handleStatutChange = useCallback((dossierId: string, etapeIndex: number, newStatut: string | null) => {
    const etape = ETAPES_BILAN[etapeIndex]
    if (etape) queueStatutPatch(dossierId, etape.cle, newStatut)

    setDossiers((prev) =>
      prev.map((d) => {
        if (d.id !== dossierId) return d
        const newStatuts = [...d.etapeStatuts]
        newStatuts[etapeIndex] = newStatut
        // Recalculate avancement locally
        let total = 0
        for (let i = 0; i < ETAPES_BILAN.length; i++) {
          const e = ETAPES_BILAN[i]
          if (e.poids === 0) continue
          const val = newStatuts[i]
          if (!val) continue
          const ratio = val === "EFFECTUE" ? 1 : val === "EN_COURS" ? 0.75 : val === "DEMI" ? 0.5 : val === "QUART" ? 0.25 : 0
          total += e.poids * ratio
        }
        return { ...d, etapeStatuts: newStatuts, avancement: Math.round(total) }
      })
    )
  }, [queueStatutPatch])

  // ── Keyboard navigation ──
  const KEY_TO_STATUT: Record<string, string | null> = { "0": null, "1": "QUART", "2": "DEMI", "3": "EN_COURS", "4": "EFFECTUE" }

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return
      if (panelDossierId || notesDossierId) return

      const ce = clickableEtapes.current

      if (e.key === "ArrowDown") {
        e.preventDefault()
        setFocusedRow((prev) => {
          const next = Math.min(prev + 1, dossiers.length - 1)
          setFocusedEtape(0)
          return next
        })
      } else if (e.key === "ArrowUp") {
        e.preventDefault()
        setFocusedRow((prev) => {
          const next = Math.max(prev - 1, 0)
          setFocusedEtape(0)
          return next
        })
      } else if (e.key === "ArrowRight") {
        e.preventDefault()
        setFocusedEtape((prev) => Math.min(prev + 1, ce.length - 1))
      } else if (e.key === "ArrowLeft") {
        e.preventDefault()
        setFocusedEtape((prev) => Math.max(prev - 1, 0))
      } else if (e.key === "Enter") {
        e.preventDefault()
        if (focusedRow >= 0 && focusedRow < dossiers.length) {
          setPanelDossierId(dossiers[focusedRow].id)
        }
      } else if (e.key === "Escape") {
        setFocusedRow(-1)
      } else if (e.key in KEY_TO_STATUT && focusedRow >= 0 && focusedRow < dossiers.length) {
        e.preventDefault()
        const d = dossiers[focusedRow]
        const etapeIdx = ce[focusedEtape]
        if (etapeIdx !== undefined) {
          handleStatutChange(d.id, etapeIdx, KEY_TO_STATUT[e.key])
        }
      }
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [dossiers, focusedRow, focusedEtape, panelDossierId, notesDossierId, handleStatutChange])

  // Scroll focused row into view
  useEffect(() => {
    if (focusedRow < 0 || !tableRef.current) return
    const rows = tableRef.current.querySelectorAll("tbody tr")
    rows[focusedRow]?.scrollIntoView({ block: "nearest" })
  }, [focusedRow])

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const toggleSelectAll = useCallback(() => {
    setSelectedIds((prev) => {
      if (prev.size === dossiers.length) return new Set()
      return new Set(dossiers.map((d) => d.id))
    })
  }, [dossiers])

  const applyBulkComment = useCallback(() => {
    if (selectedIds.size === 0) return
    const raw = bulkComment.trim()
    if (!raw) return
    const text = prefixComment(raw, userNumero)
    const ids = Array.from(selectedIds)

    // Optimistic update — append to existing comment
    setDossiers((prev) =>
      prev.map((d) => {
        if (!selectedIds.has(d.id)) return d
        const existing = d.commentaireBilan?.trim()
        const newComment = existing ? `${existing}\n${text}` : text
        return { ...d, commentaireBilan: newComment }
      })
    )

    // Persist each
    for (const id of ids) {
      const d = dossiers.find((x) => x.id === id)
      const existing = d?.commentaireBilan?.trim()
      const newComment = existing ? `${existing}\n${text}` : text
      fetch(`/api/dossiers/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ commentaireBilan: newComment }),
      })
    }

    setShowBulkComment(false)
    setBulkComment("")
  }, [selectedIds, bulkComment, userNumero, dossiers])

  const clearBulkComments = useCallback(() => {
    if (selectedIds.size === 0) return
    const ids = Array.from(selectedIds)

    setDossiers((prev) =>
      prev.map((d) => (selectedIds.has(d.id) ? { ...d, commentaireBilan: null } : d))
    )

    for (const id of ids) {
      fetch(`/api/dossiers/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ commentaireBilan: null }),
      })
    }
  }, [selectedIds])

  return (
    <>
      {/* Bulk action bar */}
      {selectedIds.size > 0 && (
        <div className="mb-2 rounded border border-blue-200 bg-blue-50 px-3 py-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-blue-700">
              {selectedIds.size} dossier{selectedIds.size > 1 ? "s" : ""} sélectionné{selectedIds.size > 1 ? "s" : ""}
            </span>
            <span className="text-gray-300">|</span>
            <button
              onClick={() => setShowBulkComment((v) => !v)}
              className="rounded border border-gray-200 bg-white px-2 py-1 text-[10px] font-medium text-gray-600 transition-colors hover:bg-gray-100"
            >
              Modifier commentaire
            </button>
            <button
              onClick={clearBulkComments}
              className="rounded border border-gray-200 bg-white px-2 py-1 text-[10px] font-medium text-red-500 transition-colors hover:bg-red-50"
            >
              Effacer commentaires
            </button>
            <button
              onClick={() => setSelectedIds(new Set())}
              className="ml-auto text-[10px] text-gray-400 hover:text-gray-600"
            >
              Désélectionner
            </button>
          </div>
          {showBulkComment && (
            <div className="mt-2 flex items-end gap-2">
              <textarea
                autoFocus
                value={bulkComment}
                onChange={(e) => setBulkComment(e.target.value)}
                rows={2}
                placeholder="Commentaire à appliquer aux dossiers sélectionnés..."
                className="flex-1 rounded border border-gray-300 bg-white px-2 py-1 text-xs text-gray-700 focus:border-blue-400 focus:outline-none"
              />
              <button
                onClick={applyBulkComment}
                className="rounded bg-blue-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-blue-700"
              >
                Appliquer
              </button>
            </div>
          )}
        </div>
      )}

      <div className="overflow-hidden rounded border border-gray-200 bg-white">
        <table ref={tableRef} className="w-full text-xs">
          <thead className="border-b border-gray-200 text-left text-[10px] font-medium uppercase tracking-wide text-gray-400">
            <tr>
              <th className="px-1 py-2 text-center">
                <input
                  type="checkbox"
                  checked={dossiers.length > 0 && selectedIds.size === dossiers.length}
                  onChange={toggleSelectAll}
                  className="h-3 w-3 rounded border-gray-300 text-blue-600 focus:ring-blue-400"
                />
              </th>
              <th className="px-3 py-2">Dossier</th>
              <th className="px-3 py-2">Collab.</th>
              <th className="px-3 py-2">Asst.</th>
              <th className="px-3 py-2">Clôture</th>
              <th className="px-3 py-2">Date limite</th>
              <th className="px-3 py-2">Avancement</th>
              <th className="px-3 py-2">Commentaire bilan</th>
              <th className="px-1 py-2 text-center" title="Notes par cycle">
                <svg className="mx-auto h-3 w-3 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </th>
              <th className="px-1 py-2 text-center" title="Nouvel échange">
                <svg className="mx-auto h-3 w-3 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                </svg>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {dossiers.map((d, rowIdx) => {
              const av = d.avancement
              const dateLimite = d.datePrevueArreteBilan ? new Date(d.datePrevueArreteBilan) : null
              const joursRestants = dateLimite
                ? Math.floor((dateLimite.getTime() - now.getTime()) / 86400000)
                : null
              const isFocused = rowIdx === focusedRow

              return (
                <tr
                  key={d.id}
                  onClick={() => { setFocusedRow(rowIdx); setFocusedEtape(0) }}
                  className={`transition-colors ${
                    isFocused
                      ? "bg-blue-50 ring-1 ring-inset ring-blue-300"
                      : selectedIds.has(d.id)
                        ? "bg-blue-50/40"
                        : "hover:bg-gray-50/60"
                  }`}
                >
                  <td className="px-1 py-2 text-center">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(d.id)}
                      onChange={() => toggleSelect(d.id)}
                      className="h-3 w-3 rounded border-gray-300 text-blue-600 focus:ring-blue-400"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <Link href={`/dossiers/${d.id}`} className="font-medium text-gray-800 hover:text-blue-600 hover:underline">
                      {d.raisonSociale}
                    </Link>
                  </td>
                  <td className="px-3 py-2 text-gray-600">
                    {d.collaborateurPrincipal ? (
                      <span>
                        {d.collaborateurPrincipal.prenom}
                        <span className="ml-1 text-[9px] text-gray-400">{ROLE_SHORT[d.collaborateurPrincipal.role] ?? ""}</span>
                      </span>
                    ) : (
                      <span className="text-gray-300">-</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-gray-500">
                    {d.firstAssistant ? d.firstAssistant.prenom : <span className="text-gray-300">-</span>}
                  </td>
                  <td className="px-3 py-2 font-mono text-[10px] text-gray-400">
                    {d.dateClotureExercice
                      ? new Date(d.dateClotureExercice).toLocaleDateString("fr-FR")
                      : <span className="text-gray-300">-</span>}
                  </td>
                  <td className="px-3 py-2">
                    {dateLimite ? (
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono text-[10px] text-gray-400">
                          {dateLimite.toLocaleDateString("fr-FR")}
                        </span>
                        {joursRestants !== null && (
                          <span
                            className={`text-[10px] font-medium ${
                              joursRestants < 0
                                ? "text-red-600"
                                : joursRestants <= 15
                                  ? "text-red-500"
                                  : joursRestants <= 30
                                    ? "text-amber-500"
                                    : "text-gray-400"
                            }`}
                          >
                            {joursRestants < 0 ? `J+${Math.abs(joursRestants)}` : `J-${joursRestants}`}
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="text-gray-300">-</span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <button
                      onClick={() => setPanelDossierId(d.id)}
                      className="group w-full rounded px-1 py-0.5 text-left transition-colors hover:bg-gray-100"
                      title="Cliquer pour modifier les étapes"
                    >
                      <div className="flex items-center gap-1.5">
                        <div className="h-1 w-14 rounded-full bg-gray-200">
                          <div
                            className={`h-1 rounded-full transition-all ${
                              av >= 100 ? "bg-green-500" : av > 50 ? "bg-amber-400" : "bg-red-400"
                            }`}
                            style={{ width: `${Math.min(av, 100)}%` }}
                          />
                        </div>
                        <span className={`text-[10px] font-medium tabular-nums ${
                          av >= 100 ? "text-green-600" : av > 50 ? "text-amber-600" : av > 0 ? "text-red-500" : "text-gray-400"
                        }`}>{av}%</span>
                      </div>
                      <div className="mt-0.5">
                        <EtapeMiniIndicators
                          dossierId={d.id}
                          statuts={d.etapeStatuts}
                          onStatutChange={handleStatutChange}
                          focusedClickableIdx={isFocused ? focusedEtape : -1}
                        />
                      </div>
                    </button>
                  </td>
                  <td className="px-3 py-2">
                    <CommentaireBilanCell dossierId={d.id} initial={d.commentaireBilan} />
                  </td>
                  <td className="px-1 py-2 text-center">
                    <button
                      onClick={() => setNotesDossierId(d.id)}
                      className="rounded p-1 text-gray-400 transition-colors hover:bg-blue-50 hover:text-blue-600"
                      title="Notes par cycle"
                    >
                      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                  </td>
                  <td className="px-1 py-2 text-center">
                    <button
                      onClick={(e) => { e.stopPropagation(); openExchangeModal(d.id, d.raisonSociale) }}
                      className="rounded p-1 text-gray-400 transition-colors hover:bg-green-50 hover:text-green-600"
                      title="Nouvel échange"
                    >
                      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                      </svg>
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {focusedRow >= 0 && (
        <div className="mt-1 flex items-center gap-3 text-[10px] text-gray-400">
          <span><kbd className="rounded border border-gray-200 bg-gray-50 px-1">↑↓</kbd> naviguer</span>
          <span><kbd className="rounded border border-gray-200 bg-gray-50 px-1">←→</kbd> étape</span>
          <span><kbd className="rounded border border-gray-200 bg-gray-50 px-1">0-4</kbd> niveau</span>
          <span><kbd className="rounded border border-gray-200 bg-gray-50 px-1">Entrée</kbd> panneau</span>
          <span><kbd className="rounded border border-gray-200 bg-gray-50 px-1">Esc</kbd> quitter</span>
        </div>
      )}

      {panelDossierId && (
        <EtatPanel
          dossierId={panelDossierId}
          onClose={() => setPanelDossierId(null)}
          onAvancementChange={handleAvancementChange}
        />
      )}

      {notesDossierId && (
        <NotesModal
          dossierId={notesDossierId}
          raisonSociale={dossiers.find((d) => d.id === notesDossierId)?.raisonSociale ?? ""}
          onClose={() => setNotesDossierId(null)}
        />
      )}

      {/* Modal: Nouvel échange */}
      {exchangeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setExchangeModal(null)}>
          <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">Nouvel échange</h3>
              <button onClick={() => setExchangeModal(null)} className="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
            </div>
            <p className="mb-4 text-sm text-gray-500">{exchangeModal.raisonSociale}</p>

            <div className="space-y-4">
              {/* Date */}
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Date du contact</label>
                <input
                  type="date"
                  value={exchangeForm.dateContact}
                  onChange={(e) => setExchangeForm({ ...exchangeForm, dateContact: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              {/* Collaborateur */}
              {collaborateurs.length > 0 && (
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Collaborateur</label>
                  <select
                    value={exchangeForm.collaborateurId}
                    onChange={(e) => setExchangeForm({ ...exchangeForm, collaborateurId: e.target.value })}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                  >
                    <option value="">— Sélectionner —</option>
                    {collaborateurs.map((c) => (
                      <option key={c.id} value={c.id}>{c.prenom}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Sens */}
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Sens du contact</label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setExchangeForm({ ...exchangeForm, sens: "SORTANT" })}
                    className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                      exchangeForm.sens === "SORTANT"
                        ? "bg-blue-100 text-blue-800 ring-2 ring-blue-300"
                        : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                    }`}
                  >
                    &#8599; Nous avons appelé
                  </button>
                  <button
                    type="button"
                    onClick={() => setExchangeForm({ ...exchangeForm, sens: "ENTRANT" })}
                    className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                      exchangeForm.sens === "ENTRANT"
                        ? "bg-green-100 text-green-800 ring-2 ring-green-300"
                        : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                    }`}
                  >
                    &#8601; Le client nous a contacté
                  </button>
                </div>
              </div>

              {/* Sujet */}
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Sujet</label>
                <input
                  type="text"
                  value={exchangeForm.sujet}
                  onChange={(e) => setExchangeForm({ ...exchangeForm, sujet: e.target.value })}
                  placeholder="Ex: Demande de documents, Relance TVA..."
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              {/* Résumé */}
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Résumé</label>
                <textarea
                  value={exchangeForm.resume}
                  onChange={(e) => setExchangeForm({ ...exchangeForm, resume: e.target.value })}
                  rows={3}
                  placeholder="Notes du contact..."
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              {/* Statut */}
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Statut</label>
                <div className="flex gap-2">
                  {(["RAS", "DEMANDE_CLIENT", "ACTION_REQUISE"] as const).map((s) => {
                    const conf = { RAS: "bg-green-100 text-green-800", DEMANDE_CLIENT: "bg-orange-100 text-orange-800", ACTION_REQUISE: "bg-red-100 text-red-800" }
                    const labels = { RAS: "RAS", DEMANDE_CLIENT: "Demande client", ACTION_REQUISE: "Action requise" }
                    return (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setExchangeForm({ ...exchangeForm, statut: s })}
                        className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                          exchangeForm.statut === s
                            ? `${conf[s]} ring-2 ring-offset-1 ring-gray-300`
                            : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                        }`}
                      >
                        {labels[s]}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Prochain contact */}
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Prochain contact prévu</label>
                <input
                  type="date"
                  value={exchangeForm.prochainContact}
                  onChange={(e) => setExchangeForm({ ...exchangeForm, prochainContact: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setExchangeModal(null)}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
              >
                Annuler
              </button>
              <button
                onClick={submitExchange}
                disabled={exchangeSaving}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {exchangeSaving ? "Enregistrement..." : "Enregistrer"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

// ──────────────────────────────────────────────

const STATUT_CYCLE: (string | null)[] = [null, "QUART", "DEMI", "EN_COURS", "EFFECTUE"]

function nextStatut(current: string | null): string | null {
  const idx = STATUT_CYCLE.indexOf(current)
  return STATUT_CYCLE[(idx + 1) % STATUT_CYCLE.length]
}

const STATUT_LABELS: Record<string, string> = {
  QUART: "25%",
  DEMI: "50%",
  EN_COURS: "75%",
  EFFECTUE: "100%",
}

function EtapeMiniIndicators({
  dossierId,
  statuts,
  onStatutChange,
  focusedClickableIdx = -1,
}: {
  dossierId: string
  statuts: (string | null)[]
  onStatutChange: (dossierId: string, index: number, newStatut: string | null) => void
  focusedClickableIdx?: number
}) {
  // Map clickable index back to absolute index
  const clickableIndices = ETAPES_BILAN.map((e, i) => ({ i, hasNote: e.hasNote })).filter((e) => !e.hasNote).map((e) => e.i)
  const focusedAbsIdx = focusedClickableIdx >= 0 ? clickableIndices[focusedClickableIdx] ?? -1 : -1
  const handleClick = useCallback(
    (e: React.MouseEvent, index: number) => {
      e.stopPropagation()
      const etape = ETAPES_BILAN[index]
      if (!etape || etape.hasNote) return

      const current = statuts[index]
      const next = nextStatut(current)
      onStatutChange(dossierId, index, next)
    },
    [dossierId, statuts, onStatutChange],
  )

  return (
    <div className="flex gap-px">
      {statuts.map((s, i) => {
        const etape = ETAPES_BILAN[i]
        const isNote = etape?.hasNote
        let bg: string
        if (isNote) {
          bg = "bg-amber-300"
        } else if (s === "EFFECTUE") {
          bg = "bg-green-500"
        } else if (s === "EN_COURS") {
          bg = "bg-amber-400"
        } else if (s === "DEMI") {
          bg = "bg-gray-400"
        } else if (s === "QUART") {
          bg = "bg-gray-300"
        } else {
          bg = "bg-gray-200"
        }

        const label = etape?.label ?? ""
        const statutLabel = s ? STATUT_LABELS[s] ?? s : "0%"
        const nextLabel = isNote ? "" : STATUT_LABELS[nextStatut(s) ?? ""] ?? "0%"

        const isKbFocused = i === focusedAbsIdx

        return (
          <div
            key={i}
            onClick={(e) => handleClick(e, i)}
            className={`h-3.5 w-2 rounded-[2px] ${bg} ${
              isNote
                ? "cursor-default"
                : "cursor-pointer transition-all hover:scale-125 hover:ring-1 hover:ring-blue-400"
            } ${isKbFocused ? "scale-150 ring-2 ring-blue-500" : ""}`}
            title={isNote ? `${label} (note)` : `${label}: ${statutLabel} → clic: ${nextLabel}`}
          />
        )
      })}
    </div>
  )
}

// ──────────────────────────────────────────────

function CommentaireBilanCell({ dossierId, initial }: { dossierId: string; initial: string | null }) {
  const { data: session } = useSession()
  const numero = (session?.user as Record<string, unknown> | undefined)?.numero as string | null ?? null
  const [value, setValue] = useState(initial ?? "")
  const [newText, setNewText] = useState("")
  const [editing, setEditing] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    setValue(initial ?? "")
  }, [initial])

  const save = useCallback(
    (text: string) => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(() => {
        fetch(`/api/dossiers/${dossierId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ commentaireBilan: text || null }),
        })
      }, 400)
    },
    [dossierId],
  )

  const handleBlur = () => {
    setEditing(false)
    if (!newText.trim()) return
    const prefixed = prefixComment(newText, numero)
    const updated = value.trim() ? `${value.trim()}\n${prefixed}` : prefixed
    setValue(updated)
    setNewText("")
    save(updated)
  }

  if (editing) {
    return (
      <div className="flex flex-col gap-1">
        {value && (
          <div className="whitespace-pre-wrap rounded bg-gray-50 px-2 py-1 text-[10px] text-gray-500 max-h-[60px] overflow-y-auto">
            {value}
          </div>
        )}
        <textarea
          autoFocus
          value={newText}
          onChange={(e) => setNewText(e.target.value)}
          onBlur={handleBlur}
          rows={2}
          className="w-full min-w-[140px] rounded border border-gray-300 bg-white px-2 py-1 text-[11px] text-gray-700 focus:border-gray-400 focus:outline-none"
          placeholder="Nouveau commentaire..."
        />
      </div>
    )
  }

  return (
    <div
      onClick={() => setEditing(true)}
      className="min-h-[24px] min-w-[100px] cursor-pointer rounded px-1.5 py-0.5 text-[11px] text-gray-500 hover:bg-gray-50"
      title="Cliquer pour modifier"
    >
      {value ? (
        <span className="line-clamp-2">{value}</span>
      ) : (
        <span className="text-gray-300 italic">—</span>
      )}
    </div>
  )
}
