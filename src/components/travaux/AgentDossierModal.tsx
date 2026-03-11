"use client"

import { useState, useCallback, useRef } from "react"
import * as XLSX from "xlsx"

interface AgentDossierModalProps {
  open: boolean
  onClose: () => void
  dossierId: string
  nomClient: string
  dateArrete: string | null
  preparateur: string
}

interface CycleData {
  code: string
  nom: string
  comptes: {
    numero: string
    libelle: string
    debit: number
    credit: number
    solde: number
  }[]
  totalDebit: number
  totalCredit: number
  totalSolde: number
  commentaire: string
  anomalies: string[]
}

interface AnalysisResult {
  meta: {
    client: string
    dateArrete: string
    preparateur: string
    datePreparation: string
    totalDebit: number
    totalCredit: number
    equilibre: boolean
  }
  cycles: CycleData[]
  synthese: {
    nbComptes: number
    nbAnomalies: number
    pointsAttention: string[]
    conclusion: string
  }
}

export default function AgentDossierModal({
  open,
  onClose,
  dossierId,
  nomClient,
  dateArrete,
  preparateur,
}: AgentDossierModalProps) {
  const [csvContent, setCsvContent] = useState<string | null>(null)
  const [fileName, setFileName] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<AnalysisResult | null>(null)
  const [step, setStep] = useState<"upload" | "analyzing" | "result">("upload")
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setError(null)
    setFileName(file.name)

    const reader = new FileReader()

    if (file.name.endsWith(".csv") || file.name.endsWith(".txt")) {
      reader.onload = (ev) => {
        setCsvContent(ev.target?.result as string)
      }
      reader.readAsText(file, "utf-8")
    } else if (file.name.endsWith(".xlsx") || file.name.endsWith(".xls")) {
      reader.onload = (ev) => {
        try {
          const data = new Uint8Array(ev.target?.result as ArrayBuffer)
          const workbook = XLSX.read(data, { type: "array" })
          const firstSheet = workbook.Sheets[workbook.SheetNames[0]]
          const csv = XLSX.utils.sheet_to_csv(firstSheet, { FS: ";" })
          setCsvContent(csv)
        } catch {
          setError("Impossible de lire le fichier Excel")
        }
      }
      reader.readAsArrayBuffer(file)
    } else {
      setError("Format non supporté. Utilisez un fichier CSV ou Excel (.xlsx)")
    }
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      const file = e.dataTransfer.files[0]
      if (file && fileInputRef.current) {
        const dt = new DataTransfer()
        dt.items.add(file)
        fileInputRef.current.files = dt.files
        handleFileChange({ target: { files: dt.files } } as React.ChangeEvent<HTMLInputElement>)
      }
    },
    [handleFileChange]
  )

  const handleAnalyze = useCallback(async () => {
    if (!csvContent) return

    setLoading(true)
    setError(null)
    setStep("analyzing")

    try {
      const res = await fetch("/api/agent/dossier", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dossierId,
          csvContent,
          preparateur,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || "Erreur lors de l'analyse")
      }

      setResult(data.data)
      setStep("result")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue")
      setStep("upload")
    } finally {
      setLoading(false)
    }
  }, [csvContent, dossierId, preparateur])

  const handleDownloadExcel = useCallback(() => {
    if (!result) return

    const wb = XLSX.utils.book_new()

    // Sheet 1 : Synthèse
    const synthRows = [
      ["DOSSIER DE TRAVAIL — ANALYSE PAR CYCLE"],
      [],
      ["Client", result.meta.client],
      ["Date d'arrêté", result.meta.dateArrete],
      ["Préparé par", result.meta.preparateur],
      ["Date de préparation", result.meta.datePreparation],
      [],
      ["Total Débit", result.meta.totalDebit],
      ["Total Crédit", result.meta.totalCredit],
      ["Équilibre", result.meta.equilibre ? "OUI" : "NON"],
      [],
      ["SYNTHÈSE"],
      ["Nombre de comptes", result.synthese.nbComptes],
      ["Nombre d'anomalies", result.synthese.nbAnomalies],
      [],
      ["Points d'attention :"],
      ...result.synthese.pointsAttention.map((p) => ["  - " + p]),
      [],
      ["Conclusion", result.synthese.conclusion],
    ]
    const wsSynth = XLSX.utils.aoa_to_sheet(synthRows)
    wsSynth["!cols"] = [{ wch: 30 }, { wch: 50 }]
    XLSX.utils.book_append_sheet(wb, wsSynth, "Synthèse")

    // Sheet per cycle
    for (const cycle of result.cycles) {
      if (cycle.comptes.length === 0) continue

      const rows = [
        [`Cycle ${cycle.code} — ${cycle.nom}`],
        [],
        ["N° Compte", "Libellé", "Débit", "Crédit", "Solde"],
        ...cycle.comptes.map((c) => [c.numero, c.libelle, c.debit, c.credit, c.solde]),
        [],
        ["TOTAL", "", cycle.totalDebit, cycle.totalCredit, cycle.totalSolde],
        [],
        ["Commentaire", cycle.commentaire || "RAS"],
      ]

      if (cycle.anomalies.length > 0) {
        rows.push([], ["Anomalies :"])
        cycle.anomalies.forEach((a) => rows.push(["  - " + a]))
      }

      const ws = XLSX.utils.aoa_to_sheet(rows)
      ws["!cols"] = [{ wch: 15 }, { wch: 40 }, { wch: 15 }, { wch: 15 }, { wch: 15 }]
      // Limit sheet name to 31 chars (Excel limit)
      const sheetName = `${cycle.code} - ${cycle.nom}`.slice(0, 31)
      XLSX.utils.book_append_sheet(wb, ws, sheetName)
    }

    // Download
    const safeName = nomClient.replace(/[^a-zA-Z0-9À-ÿ\s-]/g, "").slice(0, 30)
    XLSX.writeFile(wb, `DT_${safeName}_${new Date().toISOString().slice(0, 10)}.xlsx`)
  }, [result, nomClient])

  const handleReset = useCallback(() => {
    setCsvContent(null)
    setFileName(null)
    setResult(null)
    setError(null)
    setStep("upload")
    if (fileInputRef.current) fileInputRef.current.value = ""
  }, [])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="relative mx-4 flex max-h-[90vh] w-full max-w-2xl flex-col rounded-2xl bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b px-6 py-4">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Agent Dossier de Travail</h2>
            <p className="text-sm text-gray-500">
              {nomClient} — Préparé par {preparateur}
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Context info */}
          <div className="mb-5 rounded-lg bg-gray-50 p-4">
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <span className="text-gray-500">Client</span>
                <p className="font-medium text-gray-900">{nomClient}</p>
              </div>
              <div>
                <span className="text-gray-500">Date d&apos;arrêté</span>
                <p className="font-medium text-gray-900">{dateArrete || "Non renseignée"}</p>
              </div>
              <div>
                <span className="text-gray-500">Préparateur</span>
                <p className="font-medium text-gray-900">{preparateur}</p>
              </div>
            </div>
          </div>

          {/* Step: Upload */}
          {step === "upload" && (
            <>
              <div
                className="mb-4 flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 p-8 transition-colors hover:border-blue-400 hover:bg-blue-50/30"
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
              >
                <svg className="mb-3 h-10 w-10 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                <p className="text-sm font-medium text-gray-700">
                  Glissez votre balance ici ou cliquez pour sélectionner
                </p>
                <p className="mt-1 text-xs text-gray-400">CSV, XLS ou XLSX</p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.xls,.xlsx,.txt"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </div>

              {fileName && (
                <div className="mb-4 flex items-center gap-2 rounded-lg bg-green-50 px-4 py-3 text-sm text-green-700">
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Fichier chargé : <strong>{fileName}</strong>
                </div>
              )}

              {error && (
                <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
              )}
            </>
          )}

          {/* Step: Analyzing */}
          {step === "analyzing" && (
            <div className="flex flex-col items-center py-12">
              <div className="mb-4 h-10 w-10 animate-spin rounded-full border-4 border-blue-200 border-t-blue-600" />
              <p className="text-sm font-medium text-gray-700">Analyse en cours...</p>
              <p className="mt-1 text-xs text-gray-400">
                L&apos;IA analyse votre balance et structure le dossier de travail
              </p>
            </div>
          )}

          {/* Step: Result */}
          {step === "result" && result && (
            <div className="space-y-4">
              {/* Summary */}
              <div className="rounded-lg border border-green-200 bg-green-50 p-4">
                <h3 className="mb-2 text-sm font-semibold text-green-800">Analyse terminée</h3>
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <span className="text-green-600">Comptes analysés</span>
                    <p className="text-lg font-bold text-green-900">{result.synthese.nbComptes}</p>
                  </div>
                  <div>
                    <span className="text-green-600">Cycles identifiés</span>
                    <p className="text-lg font-bold text-green-900">{result.cycles.length}</p>
                  </div>
                  <div>
                    <span className={result.synthese.nbAnomalies > 0 ? "text-orange-600" : "text-green-600"}>
                      Anomalies
                    </span>
                    <p className={`text-lg font-bold ${result.synthese.nbAnomalies > 0 ? "text-orange-700" : "text-green-900"}`}>
                      {result.synthese.nbAnomalies}
                    </p>
                  </div>
                </div>
              </div>

              {/* Cycles overview */}
              <div className="rounded-lg border p-4">
                <h3 className="mb-3 text-sm font-semibold text-gray-700">Cycles comptables</h3>
                <div className="space-y-2">
                  {result.cycles
                    .filter((c) => c.comptes.length > 0)
                    .map((cycle) => (
                      <div
                        key={cycle.code}
                        className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2 text-sm"
                      >
                        <span className="font-medium text-gray-700">
                          {cycle.code} — {cycle.nom}
                        </span>
                        <div className="flex items-center gap-4">
                          <span className="text-gray-500">{cycle.comptes.length} comptes</span>
                          {cycle.anomalies.length > 0 && (
                            <span className="rounded-full bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-700">
                              {cycle.anomalies.length} anomalie{cycle.anomalies.length > 1 ? "s" : ""}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                </div>
              </div>

              {/* Points d'attention */}
              {result.synthese.pointsAttention.length > 0 && (
                <div className="rounded-lg border border-orange-200 bg-orange-50 p-4">
                  <h3 className="mb-2 text-sm font-semibold text-orange-800">Points d&apos;attention</h3>
                  <ul className="space-y-1 text-sm text-orange-700">
                    {result.synthese.pointsAttention.map((p, i) => (
                      <li key={i}>• {p}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Conclusion */}
              <div className="rounded-lg bg-gray-50 p-4 text-sm text-gray-700">
                <strong>Conclusion :</strong> {result.synthese.conclusion}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t px-6 py-4">
          {step === "result" ? (
            <>
              <button
                onClick={handleReset}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
              >
                Nouvelle analyse
              </button>
              <button
                onClick={handleDownloadExcel}
                className="flex items-center gap-2 rounded-lg bg-green-600 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-green-700"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Télécharger Excel
              </button>
            </>
          ) : (
            <>
              <button
                onClick={onClose}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
              >
                Annuler
              </button>
              <button
                onClick={handleAnalyze}
                disabled={!csvContent || loading}
                className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ? "Analyse en cours..." : "Analyser la balance"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
