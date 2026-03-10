"use client"

import { useState, useCallback, useEffect, useRef } from "react"
import Link from "next/link"
import EtatPanel from "./EtatPanel"
import { ETAPES_BILAN } from "@/lib/dossiers/avancement"

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

interface DossiersTableProps {
  dossiers: DossierRow[]
}

const ROLE_SHORT: Record<string, string> = {
  ASSISTANT: "Asst",
  CONFIRME: "Conf",
  SUPERVISEUR: "Sup",
  EXPERT_COMPTABLE: "EC",
}

export default function DossiersTable({ dossiers: initialDossiers }: DossiersTableProps) {
  const [panelDossierId, setPanelDossierId] = useState<string | null>(null)
  const [dossiers, setDossiers] = useState(initialDossiers)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [bulkComment, setBulkComment] = useState("")
  const [showBulkComment, setShowBulkComment] = useState(false)
  const now = new Date()

  useEffect(() => {
    setDossiers(initialDossiers)
  }, [initialDossiers])

  const handleAvancementChange = useCallback((dossierId: string, newAvancement: number) => {
    setDossiers((prev) =>
      prev.map((d) => (d.id === dossierId ? { ...d, avancement: newAvancement } : d))
    )
  }, [])

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
    const text = bulkComment.trim() || null
    const ids = Array.from(selectedIds)

    // Optimistic update
    setDossiers((prev) =>
      prev.map((d) => (selectedIds.has(d.id) ? { ...d, commentaireBilan: text } : d))
    )

    // Persist each
    for (const id of ids) {
      fetch(`/api/dossiers/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ commentaireBilan: text }),
      })
    }

    setShowBulkComment(false)
    setBulkComment("")
  }, [selectedIds, bulkComment])

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
        <table className="w-full text-xs">
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
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {dossiers.map((d) => {
              const av = d.avancement
              const dateLimite = d.datePrevueArreteBilan ? new Date(d.datePrevueArreteBilan) : null
              const joursRestants = dateLimite
                ? Math.floor((dateLimite.getTime() - now.getTime()) / 86400000)
                : null

              return (
                <tr key={d.id} className={`transition-colors ${selectedIds.has(d.id) ? "bg-blue-50/40" : "hover:bg-gray-50/60"}`}>
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
                        <EtapeMiniIndicators statuts={d.etapeStatuts} />
                      </div>
                    </button>
                  </td>
                  <td className="px-3 py-2">
                    <CommentaireBilanCell dossierId={d.id} initial={d.commentaireBilan} />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {panelDossierId && (
        <EtatPanel
          dossierId={panelDossierId}
          onClose={() => setPanelDossierId(null)}
          onAvancementChange={handleAvancementChange}
        />
      )}
    </>
  )
}

// ──────────────────────────────────────────────

function EtapeMiniIndicators({ statuts }: { statuts: (string | null)[] }) {
  return (
    <div className="flex gap-px">
      {statuts.map((s, i) => {
        const isNote = ETAPES_BILAN[i]?.hasNote
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
          bg = "bg-gray-150"
          return (
            <div
              key={i}
              className="h-2.5 w-1 rounded-[1px] bg-gray-200"
              title={ETAPES_BILAN[i]?.label}
            />
          )
        }
        return (
          <div
            key={i}
            className={`h-2.5 w-1 rounded-[1px] ${bg}`}
            title={ETAPES_BILAN[i]?.label}
          />
        )
      })}
    </div>
  )
}

// ──────────────────────────────────────────────

function CommentaireBilanCell({ dossierId, initial }: { dossierId: string; initial: string | null }) {
  const [value, setValue] = useState(initial ?? "")
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

  if (editing) {
    return (
      <textarea
        autoFocus
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={() => {
          setEditing(false)
          save(value)
        }}
        rows={2}
        className="w-full min-w-[140px] rounded border border-gray-300 bg-white px-2 py-1 text-[11px] text-gray-700 focus:border-gray-400 focus:outline-none"
        placeholder="Commentaire..."
      />
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
