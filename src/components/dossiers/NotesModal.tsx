"use client"

import { useState, useCallback, useEffect } from "react"
import { useToast } from "@/components/ui/Toast"

const CYCLES_NOTES = [
  { key: "GENERAL", label: "Note Générale", icone: "📋" },
  { key: "TRESORERIE", label: "Trésorerie", icone: "🏦" },
  { key: "ACHATS_FOURNISSEURS", label: "Achats et Fournisseurs", icone: "🛒" },
  { key: "CHARGES_EXTERNES", label: "Charges Externes", icone: "💳" },
  { key: "VENTES_CLIENTS", label: "Ventes et Clients", icone: "💰" },
  { key: "STOCK", label: "Stock", icone: "📦" },
  { key: "IMMOBILISATIONS", label: "Immobilisations", icone: "🏗️" },
  { key: "SOCIAL_PAIE", label: "Social et Paie", icone: "👥" },
  { key: "ETAT", label: "État", icone: "🏛️" },
  { key: "CAPITAUX_PROPRES", label: "Capitaux Propres", icone: "📊" },
  { key: "AUTRES", label: "Autres", icone: "📝" },
] as const

interface NotesModalProps {
  dossierId: string
  raisonSociale: string
  onClose: () => void
}

export default function NotesModal({ dossierId, raisonSociale, onClose }: NotesModalProps) {
  const toast = useToast()
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [expandedCycle, setExpandedCycle] = useState<string | null>("GENERAL")

  // Fetch notes on open
  useEffect(() => {
    fetch(`/api/dossiers/${dossierId}`)
      .then((r) => r.json())
      .then((d) => {
        const existing = (d.notesCycles ?? {}) as Record<string, string>
        const init: Record<string, string> = {}
        for (const c of CYCLES_NOTES) init[c.key] = existing[c.key] ?? ""
        setNotes(init)
      })
      .catch(() => toast.error("Erreur de chargement des notes"))
      .finally(() => setLoading(false))
  }, [dossierId, toast])

  const handleSave = useCallback(async () => {
    setSaving(true)
    const cleaned: Record<string, string> = {}
    for (const [k, v] of Object.entries(notes)) {
      if (v.trim()) cleaned[k] = v
    }
    try {
      const res = await fetch(`/api/dossiers/${dossierId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notesCycles: Object.keys(cleaned).length > 0 ? cleaned : null }),
      })
      if (!res.ok) throw new Error()
      toast.success("Notes enregistrées")
    } catch {
      toast.error("Erreur lors de la sauvegarde")
    } finally {
      setSaving(false)
    }
  }, [notes, dossierId, toast])

  const handleExportTxt = useCallback(() => {
    const separator = "═".repeat(60)
    const lines: string[] = [
      `NOTES DU DOSSIER — ${raisonSociale}`,
      `Date d'export : ${new Date().toLocaleDateString("fr-FR")}`,
      separator,
      "",
    ]

    for (const cycle of CYCLES_NOTES) {
      const content = notes[cycle.key]?.trim()
      lines.push(`${cycle.icone} ${cycle.label.toUpperCase()}`)
      lines.push(content || "(aucune note)")
      lines.push("")
      lines.push(separator)
      lines.push("")
    }

    const blob = new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    const safeName = raisonSociale.replace(/[^a-zA-Z0-9À-ÿ\s-]/g, "").slice(0, 30)
    a.download = `Notes_${safeName}_${new Date().toISOString().slice(0, 10)}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }, [notes, raisonSociale])

  const hasContent = (key: string) => !!notes[key]?.trim()
  const filledCount = CYCLES_NOTES.filter((c) => hasContent(c.key)).length

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [onClose])

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40 bg-black/20" onClick={onClose} />

      {/* Panel (right slide-out like EtatPanel) */}
      <div className="fixed right-0 top-0 z-50 flex h-full w-[420px] flex-col border-l border-gray-200 bg-white shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b px-5 py-4">
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-sm font-bold text-gray-900">{raisonSociale}</h2>
            <p className="text-xs text-gray-500">
              Notes par cycle — {filledCount}/{CYCLES_NOTES.length} renseigné{filledCount > 1 ? "s" : ""}
            </p>
          </div>
          <button
            onClick={onClose}
            className="ml-2 rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-200 border-t-blue-600" />
            </div>
          ) : (
            <div className="space-y-1.5">
              {CYCLES_NOTES.map((cycle) => {
                const isExpanded = expandedCycle === cycle.key
                const filled = hasContent(cycle.key)
                return (
                  <div
                    key={cycle.key}
                    className={`rounded-lg border transition-colors ${
                      isExpanded
                        ? "border-blue-200 bg-blue-50/30"
                        : filled
                          ? "border-green-200 bg-green-50/20"
                          : "border-gray-100"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => setExpandedCycle(isExpanded ? null : cycle.key)}
                      className="flex w-full items-center justify-between px-3 py-2"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-sm">{cycle.icone}</span>
                        <span className="text-xs font-medium text-gray-800">{cycle.label}</span>
                        {filled && (
                          <span className="rounded-full bg-green-100 px-1.5 py-0.5 text-[9px] font-medium text-green-700">
                            renseigné
                          </span>
                        )}
                      </div>
                      <svg
                        className={`h-3.5 w-3.5 text-gray-400 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                    {isExpanded && (
                      <div className="border-t px-3 py-2">
                        <textarea
                          value={notes[cycle.key] ?? ""}
                          onChange={(e) =>
                            setNotes((prev) => ({ ...prev, [cycle.key]: e.target.value }))
                          }
                          placeholder={`Notes pour ${cycle.label}...`}
                          rows={3}
                          className="w-full resize-y rounded border border-gray-200 px-2 py-1.5 text-xs text-gray-700 placeholder-gray-400 focus:border-blue-400 focus:outline-none"
                        />
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t px-5 py-3">
          <button
            onClick={handleExportTxt}
            disabled={loading}
            className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-50 disabled:opacity-50"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Exporter TXT
          </button>
          <button
            onClick={handleSave}
            disabled={saving || loading}
            className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? "Enregistrement..." : "Enregistrer"}
          </button>
        </div>
      </div>
    </>
  )
}
