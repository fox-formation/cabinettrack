"use client"

import { useState, useCallback } from "react"
import { detailAvancement, calculerAvancement } from "@/lib/dossiers/avancement"
import type { StatutLevel } from "@/lib/dossiers/avancement"
import type { Dossier } from "@prisma/client"

interface BarreAvancementProps {
  dossier: Dossier
  dossierId: string
}

const CYCLE: (string | null)[] = [null, "QUART", "DEMI", "EN_COURS", "EFFECTUE"]

function nextStatut(current: string | null): string | null {
  const idx = CYCLE.indexOf(current)
  return CYCLE[(idx + 1) % CYCLE.length]
}

const NIVEAU: Record<StatutLevel, { icon: string; label: string; bg: string; text: string; badge: string }> = {
  effectue:    { icon: "\u2705", label: "100%", bg: "bg-green-50 hover:bg-green-100",   text: "text-green-700 line-through decoration-green-400", badge: "bg-green-200 text-green-800" },
  en_cours:    { icon: "\u25D5", label: "75%",  bg: "bg-orange-50 hover:bg-orange-100", text: "text-orange-700", badge: "bg-orange-200 text-orange-800" },
  demi:        { icon: "\u25D1", label: "50%",  bg: "bg-indigo-50 hover:bg-indigo-100", text: "text-indigo-700", badge: "bg-indigo-200 text-indigo-800" },
  quart:       { icon: "\u25D4", label: "25%",  bg: "bg-blue-50 hover:bg-blue-100",     text: "text-blue-700",   badge: "bg-blue-200 text-blue-800" },
  non_demarre: { icon: "\u2B1C", label: "0%",   bg: "bg-white hover:bg-gray-50",        text: "text-gray-600",   badge: "bg-gray-200 text-gray-500" },
}

export default function BarreAvancement({ dossier: initialDossier, dossierId }: BarreAvancementProps) {
  const [dossier, setDossier] = useState(initialDossier)
  const [saving, setSaving] = useState<string | null>(null)
  const [expandedNote, setExpandedNote] = useState<string | null>(null)

  const avancement = calculerAvancement(dossier)
  const etapes = detailAvancement(dossier)

  const barColor =
    avancement >= 100
      ? "bg-green-500"
      : avancement > 50
        ? "bg-orange-400"
        : "bg-red-500"

  const patchDossier = useCallback(async (field: string, value: string | null) => {
    setSaving(field)
    const previous = { ...dossier }

    // Optimistic update
    setDossier((d) => ({ ...d, [field]: value } as Dossier))

    try {
      const res = await fetch(`/api/dossiers/${dossierId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: value }),
      })
      if (!res.ok) throw new Error("PATCH failed")
    } catch {
      setDossier(previous as Dossier)
    } finally {
      setSaving(null)
    }
  }, [dossier, dossierId])

  const handleToggle = useCallback((cle: string) => {
    const current = dossier[cle as keyof Dossier] as string | null
    const next = nextStatut(current)
    patchDossier(cle, next)
  }, [dossier, patchDossier])

  const handleNoteBlur = useCallback((noteField: string, value: string) => {
    const current = dossier[noteField as keyof Dossier] as string | null
    if (value !== (current ?? "")) {
      patchDossier(noteField, value || null)
    }
  }, [dossier, patchDossier])

  // Check if parent step is at EFFECTUE for note editability
  // Manquant saisie → editable if statutCourantSaisie !== EFFECTUE
  // Manquant revision → editable if statutRevisionFaite !== EFFECTUE
  function isNoteEditable(etapeCle: string): boolean {
    if (etapeCle === "statutManquantSaisie") {
      return dossier.statutCourantSaisie !== "EFFECTUE"
    }
    if (etapeCle === "statutManquantRevision") {
      return dossier.statutRevisionFaite !== "EFFECTUE"
    }
    return true
  }

  return (
    <div>
      {/* Barre globale */}
      <div className="mb-2 flex items-center gap-4">
        <div className="flex-1">
          <div className="h-3 rounded-full bg-gray-200">
            <div
              className={`h-3 rounded-full transition-all duration-300 ${barColor}`}
              style={{ width: `${Math.min(avancement, 100)}%` }}
            />
          </div>
        </div>
        <span className={`text-2xl font-bold ${
          avancement >= 100 ? "text-green-600" : avancement > 50 ? "text-orange-500" : "text-red-500"
        }`}>
          {Math.round(avancement)}%
        </span>
      </div>

      <p className="mb-4 text-[10px] text-gray-400">
        Cliquer pour cycler : 0% &rarr; 25% &rarr; 50% &rarr; 75% &rarr; 100% &rarr; 0%
      </p>

      {/* Étapes */}
      <div className="space-y-1">
        {etapes.map((etape) => {
          const isSaving = saving === etape.cle
          const isNote = etape.hasNote
          const display = NIVEAU[etape.statut]
          const editable = isNote ? isNoteEditable(etape.cle) : true

          return (
            <div key={etape.cle}>
              <button
                onClick={() => !isNote && handleToggle(etape.cle)}
                disabled={isSaving || isNote}
                className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors ${
                  isNote ? "cursor-default" : display.bg
                }`}
              >
                {/* Icon */}
                {!isNote && (
                  <span className="text-base flex-shrink-0">{display.icon}</span>
                )}
                {isNote && (
                  <span className="flex-shrink-0 text-amber-500">
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </span>
                )}

                {/* Label */}
                <span className={`flex-1 text-sm ${isNote ? "text-amber-700 font-medium" : display.text}`}>
                  {etape.label}
                </span>

                {/* Badge / note toggle */}
                {isNote ? (
                  <span
                    onClick={(e) => { e.stopPropagation(); setExpandedNote(expandedNote === etape.cle ? null : etape.cle) }}
                    className={`cursor-pointer rounded px-2 py-0.5 text-[10px] font-bold ${
                      editable ? "bg-amber-100 text-amber-700 hover:bg-amber-200" : "bg-gray-100 text-gray-400"
                    }`}
                  >
                    {etape.noteValue ? "Voir note" : editable ? "Ajouter" : "Verrouillé"}
                  </span>
                ) : (
                  <span className={`rounded px-1.5 py-0.5 text-[9px] font-bold ${display.badge}`}>
                    {display.label}
                  </span>
                )}

                {/* Poids */}
                {!isNote && (
                  <span className="text-[10px] text-gray-400 tabular-nums w-6 text-right">{etape.poids}%</span>
                )}

                {/* Saving */}
                {isSaving && (
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-blue-500" />
                )}
              </button>

              {/* Note expandable */}
              {isNote && expandedNote === etape.cle && (
                <div className="ml-8 mb-2 mr-2">
                  {editable ? (
                    <textarea
                      className="w-full rounded-md border border-amber-200 bg-amber-50/50 px-3 py-2 text-sm text-gray-700 placeholder:text-gray-400 focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400"
                      rows={2}
                      placeholder="Éléments manquants..."
                      defaultValue={etape.noteValue ?? ""}
                      onBlur={(e) => {
                        if (etape.noteField) handleNoteBlur(etape.noteField, e.target.value)
                      }}
                    />
                  ) : (
                    <div className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-500">
                      {etape.noteValue || <span className="italic text-gray-400">Aucune note</span>}
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
