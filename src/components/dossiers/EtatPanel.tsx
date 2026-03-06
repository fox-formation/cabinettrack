"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import Link from "next/link"

type StatutLevel = "effectue" | "en_cours" | "demi" | "quart" | "non_demarre"

interface EtapeData {
  cle: string
  label: string
  poids: number
  hasNote: boolean
  noteField?: string
  statut: StatutLevel
  rawValue: string | null
  noteValue?: string | null
}

interface EtatData {
  id: string
  raisonSociale: string
  collaborateur: string | null
  assistant: string | null
  avancement: number
  etapes: EtapeData[]
  updatedAt: string
}

interface EtatPanelProps {
  dossierId: string
  onClose: () => void
  onAvancementChange?: (dossierId: string, newAvancement: number) => void
}

const STATUT_CYCLE: StatutLevel[] = ["non_demarre", "quart", "demi", "en_cours", "effectue"]

const STATUT_DB_MAP: Record<StatutLevel, string | null> = {
  non_demarre: null,
  quart: "QUART",
  demi: "DEMI",
  en_cours: "EN_COURS",
  effectue: "EFFECTUE",
}

const STATUT_RATIO: Record<StatutLevel, number> = {
  non_demarre: 0,
  quart: 0.25,
  demi: 0.5,
  en_cours: 0.75,
  effectue: 1,
}

function nextStatut(current: StatutLevel): StatutLevel {
  const idx = STATUT_CYCLE.indexOf(current)
  return STATUT_CYCLE[(idx + 1) % STATUT_CYCLE.length]
}

function computeAvancement(etapes: EtapeData[]): number {
  return etapes.reduce((total, e) => {
    if (e.poids === 0) return total
    return total + e.poids * STATUT_RATIO[e.statut]
  }, 0)
}

export default function EtatPanel({ dossierId, onClose, onAvancementChange }: EtatPanelProps) {
  const [data, setData] = useState<EtatData | null>(null)
  const [loading, setLoading] = useState(true)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/dossiers/${dossierId}/etat`)
      .then((r) => r.json())
      .then((d: EtatData) => {
        setData(d)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [dossierId])

  const patchField = useCallback(
    (field: string, value: string | null) => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(() => {
        fetch(`/api/dossiers/${dossierId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ [field]: value }),
        })
      }, 300)
    },
    [dossierId],
  )

  const toggleEtape = useCallback(
    (cle: string) => {
      setData((prev) => {
        if (!prev) return prev
        const newEtapes = prev.etapes.map((e) => {
          if (e.cle !== cle) return e
          const next = nextStatut(e.statut)
          patchField(cle, STATUT_DB_MAP[next])
          return { ...e, statut: next }
        })
        const newAv = computeAvancement(newEtapes)
        onAvancementChange?.(dossierId, newAv)
        return { ...prev, etapes: newEtapes, avancement: newAv }
      })
    },
    [dossierId, patchField, onAvancementChange],
  )

  const saveNote = useCallback(
    (noteField: string, value: string) => {
      setData((prev) => {
        if (!prev) return prev
        return {
          ...prev,
          etapes: prev.etapes.map((e) =>
            e.noteField === noteField ? { ...e, noteValue: value || null } : e
          ),
        }
      })
      patchField(noteField, value || null)
    },
    [patchField],
  )

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [onClose])

  const avancement = data?.avancement ?? 0

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-black/20"
        onClick={onClose}
      />

      <div className="fixed right-0 top-0 z-50 flex h-full w-[380px] flex-col border-l border-gray-200 bg-white">
        {/* Header */}
        <div className="border-b border-gray-200 px-5 py-3">
          <div className="flex items-start justify-between">
            <div className="min-w-0 flex-1">
              <h2 className="truncate text-sm font-semibold text-gray-800">
                {data?.raisonSociale ?? "Chargement..."}
              </h2>
              {data && (
                <p className="mt-0.5 text-[11px] text-gray-400">
                  {[data.collaborateur, data.assistant].filter(Boolean).join(" / ")}
                </p>
              )}
            </div>
            <button
              onClick={onClose}
              className="ml-3 rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {data && (
            <div className="mt-2 flex items-center gap-2">
              <div className="flex-1">
                <div className="h-1.5 rounded-full bg-gray-100">
                  <div
                    className={`h-1.5 rounded-full transition-all ${
                      avancement >= 100 ? "bg-green-500" : avancement > 50 ? "bg-amber-400" : "bg-red-400"
                    }`}
                    style={{ width: `${Math.min(avancement, 100)}%` }}
                  />
                </div>
              </div>
              <span className={`text-sm font-semibold tabular-nums ${
                avancement >= 100 ? "text-green-600" : avancement > 50 ? "text-amber-600" : avancement > 0 ? "text-red-500" : "text-gray-400"
              }`}>{avancement}%</span>
            </div>
          )}
        </div>

        {/* Etapes */}
        <div className="flex-1 overflow-y-auto px-5 py-3">
          {loading && (
            <div className="flex items-center justify-center py-12">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-gray-400 border-t-transparent" />
            </div>
          )}

          {data && (
            <div className="space-y-px">
              {data.etapes.map((etape) => (
                <EtapeLigne
                  key={etape.cle}
                  etape={etape}
                  onToggle={() => toggleEtape(etape.cle)}
                  onNoteSave={(val) => saveNote(etape.noteField!, val)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 px-5 py-3">
          <Link
            href={`/dossiers/${dossierId}`}
            className="block w-full rounded border border-gray-300 px-3 py-2 text-center text-xs font-medium text-gray-600 hover:bg-gray-50"
          >
            Voir le dossier complet
          </Link>
          {data?.updatedAt && (
            <p className="mt-1.5 text-center text-[10px] text-gray-400">
              Mis à jour le {new Date(data.updatedAt).toLocaleDateString("fr-FR")}
            </p>
          )}
        </div>
      </div>
    </>
  )
}

// ──────────────────────────────────────────────

function EtapeLigne({
  etape,
  onToggle,
  onNoteSave,
}: {
  etape: EtapeData
  onToggle: () => void
  onNoteSave: (val: string) => void
}) {
  const [noteText, setNoteText] = useState(etape.noteValue ?? "")

  useEffect(() => {
    setNoteText(etape.noteValue ?? "")
  }, [etape.noteValue])

  if (etape.hasNote) {
    const hasContent = !!noteText.trim()
    return (
      <div className="rounded border border-gray-200 bg-gray-50/50 p-2.5">
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400">{hasContent ? "\u{1F4CB}" : "\u2610"}</span>
          <span className="text-xs font-medium text-gray-600">{etape.label}</span>
          {hasContent && (
            <span className="ml-auto text-[9px] text-gray-400">Note</span>
          )}
        </div>
        <textarea
          value={noteText}
          onChange={(e) => setNoteText(e.target.value)}
          onBlur={() => onNoteSave(noteText)}
          rows={2}
          placeholder="Notes..."
          className="mt-1.5 w-full rounded border border-gray-200 bg-white px-2 py-1 text-xs text-gray-600 placeholder-gray-300 focus:border-gray-300 focus:outline-none"
        />
      </div>
    )
  }

  const LABEL: Record<StatutLevel, string> = {
    effectue: "100%", en_cours: "75%", demi: "50%", quart: "25%", non_demarre: "0%",
  }

  const TEXT_COLOR: Record<StatutLevel, string> = {
    effectue: "text-green-600",
    en_cours: "text-amber-600",
    demi: "text-gray-600",
    quart: "text-gray-500",
    non_demarre: "text-gray-400",
  }

  const BADGE_STYLE: Record<StatutLevel, string> = {
    effectue: "text-green-600",
    en_cours: "text-amber-600",
    demi: "text-gray-500",
    quart: "text-gray-400",
    non_demarre: "text-gray-300",
  }

  return (
    <button
      onClick={onToggle}
      className="flex w-full items-center gap-2 rounded px-2.5 py-2 text-left transition-colors hover:bg-gray-50"
    >
      <span className={`text-xs ${TEXT_COLOR[etape.statut]}`}>
        {etape.statut === "effectue" ? "\u2713" : etape.statut === "non_demarre" ? "\u2022" : "\u25CB"}
      </span>
      <span className={`flex-1 text-xs ${
        etape.statut === "effectue" ? "text-gray-400 line-through" : "text-gray-700"
      }`}>{etape.label}</span>
      <span className={`text-[10px] font-medium tabular-nums ${BADGE_STYLE[etape.statut]}`}>
        {LABEL[etape.statut]}
      </span>
      {etape.poids > 0 && (
        <span className="text-[9px] text-gray-300 tabular-nums">{etape.poids}%</span>
      )}
    </button>
  )
}
