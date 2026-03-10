"use client"

import { useState, useRef, useCallback, useEffect } from "react"
import { signOut } from "next-auth/react"
import { useTheme } from "@/components/ThemeProvider"
import { THEMES, THEME_LABELS, THEME_KEYS } from "@/lib/theme/themes"

// ── Types ──────────────────────────────────────────

interface ImportResult {
  total: number
  imported: number
  errors: number
  unmappedHeaders: string[]
  results: { line: number; raisonSociale: string; status: "ok" | "error"; error?: string }[]
}

interface ImportHistoryEntry {
  id: string
  fileName: string
  total: number
  imported: number
  errors: number
  unmappedHeaders: string[]
  createdAt: string
  hasFile: boolean
}

type TabKey = "importation" | "cabinet" | "couleur"

const TABS: { key: TabKey; label: string }[] = [
  { key: "importation", label: "Importation" },
  { key: "cabinet", label: "Informations du cabinet" },
  { key: "couleur", label: "Couleur du menu" },
]

// ── Component ──────────────────────────────────────

export default function ParametresPage() {
  const { themeKey, setTheme } = useTheme()
  const [activeTab, setActiveTab] = useState<TabKey>("importation")

  // Import state
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState<ImportResult | null>(null)
  const [importError, setImportError] = useState<string | null>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // History state
  const [history, setHistory] = useState<ImportHistoryEntry[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)

  const fetchHistory = useCallback(async () => {
    setHistoryLoading(true)
    try {
      const res = await fetch("/api/import/history")
      if (res.ok) setHistory(await res.json())
    } catch {
      // silent
    } finally {
      setHistoryLoading(false)
    }
  }, [])

  useEffect(() => {
    if (activeTab === "importation") fetchHistory()
  }, [activeTab, fetchHistory])

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null
    setSelectedFile(file)
    setImportResult(null)
    setImportError(null)
  }, [])

  const handleImport = useCallback(async () => {
    if (!selectedFile) return
    setImporting(true)
    setImportResult(null)
    setImportError(null)

    try {
      const formData = new FormData()
      formData.append("file", selectedFile)

      const res = await fetch("/api/import/execute", {
        method: "POST",
        body: formData,
      })

      if (!res.ok) {
        const err = await res.json()
        setImportError(err.error || "Erreur lors de l'import")
        return
      }

      const result: ImportResult = await res.json()
      setImportResult(result)
      setSelectedFile(null)
      if (fileInputRef.current) fileInputRef.current.value = ""
      fetchHistory()
    } catch {
      setImportError("Erreur réseau lors de l'import")
    } finally {
      setImporting(false)
    }
  }, [selectedFile, fetchHistory])

  return (
    <main className="p-8">
      <h1 className="text-2xl font-bold text-gray-900">Paramètres</h1>
      <p className="mt-1 text-sm text-gray-500">Personnalisez votre espace et importez vos données</p>

      {/* Tabs */}
      <div className="mt-6 flex gap-1 border-b border-gray-200">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-5 py-2.5 text-sm font-medium transition-colors ${
              activeTab === tab.key
                ? "border-b-2 border-blue-600 text-blue-600"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="mt-6 max-w-2xl">
        {/* ── Tab: Importation ──────────────────────── */}
        {activeTab === "importation" && (
          <div className="space-y-6">
            <section className="rounded-xl bg-white p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-gray-900">Importation de dossiers</h2>
              <p className="mt-1 text-sm text-gray-500">
                Importez vos dossiers depuis un fichier Excel. Téléchargez d&apos;abord le modèle, remplissez-le, puis importez-le.
              </p>

              {/* Règles d'import */}
              <div className="mt-4 rounded-lg border border-blue-200 bg-blue-50 p-4">
                <h3 className="text-sm font-semibold text-blue-800">Règles d&apos;importation</h3>
                <ul className="mt-2 space-y-1.5 text-xs text-blue-700">
                  <li className="flex items-start gap-2">
                    <span className="mt-0.5 inline-block h-1.5 w-1.5 flex-shrink-0 rounded-full bg-blue-500" />
                    <span><strong>Nouveau dossier</strong> : si la raison sociale n&apos;existe pas encore, le dossier est créé avec toutes les données du fichier.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="mt-0.5 inline-block h-1.5 w-1.5 flex-shrink-0 rounded-full bg-blue-500" />
                    <span><strong>Dossier existant</strong> : si la raison sociale existe déjà, seules les cases remplies dans le fichier Excel sont mises à jour. <strong>Les cases vides ne modifient pas</strong> les données existantes.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="mt-0.5 inline-block h-1.5 w-1.5 flex-shrink-0 rounded-full bg-red-500" />
                    <span><strong>Supprimer une valeur</strong> : pour effacer explicitement un champ existant, écrivez <code className="rounded bg-blue-100 px-1 py-0.5 font-mono text-blue-900">a supprimer</code> dans la case concernée.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="mt-0.5 inline-block h-1.5 w-1.5 flex-shrink-0 rounded-full bg-blue-500" />
                    <span>Le champ <strong>Raison sociale</strong> est obligatoire sur chaque ligne et sert de clé d&apos;identification.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="mt-0.5 inline-block h-1.5 w-1.5 flex-shrink-0 rounded-full bg-blue-500" />
                    <span><strong>Noms de colonnes flexibles</strong> : il n&apos;est pas nécessaire de respecter exactement le modèle. Les colonnes sont reconnues automatiquement grâce à des synonymes (ex : &quot;Nom du dossier&quot;, &quot;Raison sociale&quot;, &quot;Client&quot; sont tous reconnus). La casse et les accents sont ignorés. Les colonnes non reconnues sont simplement ignorées.</span>
                  </li>
                </ul>
              </div>

              {/* Step 1: Download template */}
              <div className="mt-5 rounded-lg border border-gray-200 bg-gray-50 p-4">
                <div className="flex items-start gap-4">
                  <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-blue-100 text-sm font-bold text-blue-700">
                    1
                  </div>
                  <div className="flex-1">
                    <h3 className="text-sm font-semibold text-gray-900">Télécharger le modèle Excel</h3>
                    <p className="mt-1 text-xs text-gray-500">
                      Le fichier contient toutes les colonnes acceptées par l&apos;application, une ligne d&apos;exemple,
                      une feuille de légende et une feuille des valeurs acceptées pour chaque champ.
                    </p>
                    <a
                      href="/api/import/template"
                      download
                      className="mt-3 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                    >
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      Télécharger CabinetTrack_modele_import.xlsx
                    </a>
                  </div>
                </div>
              </div>

              {/* Step 2: Upload */}
              <div className="mt-4 rounded-lg border border-gray-200 bg-gray-50 p-4">
                <div className="flex items-start gap-4">
                  <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-blue-100 text-sm font-bold text-blue-700">
                    2
                  </div>
                  <div className="flex-1">
                    <h3 className="text-sm font-semibold text-gray-900">Importer votre fichier</h3>
                    <p className="mt-1 text-xs text-gray-500">
                      Sélectionnez votre fichier Excel rempli. Les nouveaux dossiers seront créés, les existants mis à jour
                      (seules les cases remplies sont modifiées, les cases vides sont ignorées).
                    </p>
                    <div className="mt-3 flex items-center gap-3">
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept=".xlsx,.xls"
                        onChange={handleFileChange}
                        className="text-sm text-gray-500 file:mr-3 file:rounded-lg file:border-0 file:bg-gray-200 file:px-4 file:py-2 file:text-sm file:font-medium file:text-gray-700 hover:file:bg-gray-300"
                      />
                      {selectedFile && (
                        <button
                          onClick={handleImport}
                          disabled={importing}
                          className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
                        >
                          {importing ? "Import en cours..." : "Lancer l'import"}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Import error */}
              {importError && (
                <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-4">
                  <p className="text-sm font-medium text-red-800">{importError}</p>
                </div>
              )}

              {/* Import results */}
              {importResult && (
                <div className="mt-4 space-y-3">
                  <div className="rounded-lg border border-gray-200 bg-white p-4">
                    <h4 className="text-sm font-semibold text-gray-900">Résultat de l&apos;import</h4>
                    <div className="mt-3 flex gap-6 text-sm">
                      <span className="text-gray-600">
                        Total : <span className="font-bold">{importResult.total}</span> lignes
                      </span>
                      <span className="text-green-600">
                        Importés : <span className="font-bold">{importResult.imported}</span>
                      </span>
                      {importResult.errors > 0 && (
                        <span className="text-red-600">
                          Erreurs : <span className="font-bold">{importResult.errors}</span>
                        </span>
                      )}
                    </div>
                    {importResult.unmappedHeaders.length > 0 && (
                      <div className="mt-3">
                        <p className="text-xs text-amber-600">
                          Colonnes non reconnues (ignorées) : {importResult.unmappedHeaders.join(", ")}
                        </p>
                      </div>
                    )}
                  </div>

                  {importResult.errors > 0 && (
                    <div className="rounded-lg border border-red-200 bg-red-50 p-4">
                      <h4 className="mb-2 text-sm font-semibold text-red-800">Détail des erreurs</h4>
                      <div className="max-h-48 overflow-y-auto space-y-1">
                        {importResult.results
                          .filter((r) => r.status === "error")
                          .map((r) => (
                            <p key={r.line} className="text-xs text-red-700">
                              Ligne {r.line} ({r.raisonSociale}) : {r.error}
                            </p>
                          ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </section>

            {/* Import History */}
            <section className="rounded-xl bg-white p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-gray-900">Historique des imports</h2>
              <p className="mt-1 text-sm text-gray-500">Vos 20 derniers imports</p>

              {historyLoading && history.length === 0 ? (
                <p className="mt-4 text-sm text-gray-400">Chargement...</p>
              ) : history.length === 0 ? (
                <p className="mt-4 text-sm text-gray-400">Aucun import effectué pour le moment.</p>
              ) : (
                <div className="mt-4 overflow-hidden rounded-lg border border-gray-200">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-gray-50 text-xs font-medium uppercase text-gray-500">
                        <th className="px-4 py-2 text-left">Date</th>
                        <th className="px-4 py-2 text-left">Fichier</th>
                        <th className="px-4 py-2 text-center">Total</th>
                        <th className="px-4 py-2 text-center">Importés</th>
                        <th className="px-4 py-2 text-center">Erreurs</th>
                        <th className="px-4 py-2 text-left">Statut</th>
                      </tr>
                    </thead>
                    <tbody>
                      {history.map((h) => (
                        <tr key={h.id} className="border-b last:border-b-0 hover:bg-gray-50">
                          <td className="px-4 py-2.5 text-gray-600">
                            {new Date(h.createdAt).toLocaleDateString("fr-FR", {
                              day: "2-digit",
                              month: "2-digit",
                              year: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </td>
                          <td className="px-4 py-2.5 font-medium max-w-[200px] truncate">
                            {h.hasFile ? (
                              <a
                                href={`/api/import/download/${h.id}`}
                                download
                                className="text-blue-600 hover:text-blue-800 hover:underline"
                                title="Télécharger le fichier"
                              >
                                {h.fileName}
                              </a>
                            ) : (
                              <span className="text-gray-900">{h.fileName}</span>
                            )}
                          </td>
                          <td className="px-4 py-2.5 text-center text-gray-600">{h.total}</td>
                          <td className="px-4 py-2.5 text-center text-green-600 font-medium">{h.imported}</td>
                          <td className="px-4 py-2.5 text-center">
                            {h.errors > 0 ? (
                              <span className="font-medium text-red-600">{h.errors}</span>
                            ) : (
                              <span className="text-gray-300">0</span>
                            )}
                          </td>
                          <td className="px-4 py-2.5">
                            {h.errors === 0 ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                                <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                                Complet
                              </span>
                            ) : h.imported > 0 ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                                Partiel
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
                                Échoué
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </div>
        )}

        {/* ── Tab: Informations du cabinet ──────────── */}
        {activeTab === "cabinet" && (
          <section className="rounded-xl bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-gray-900">Informations du cabinet</h2>
            <p className="mt-1 text-sm text-gray-500">
              Données de votre espace de travail (lecture seule)
            </p>

            <dl className="mt-5 space-y-4">
              <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                <dt className="text-sm font-medium text-gray-500">Application</dt>
                <dd className="text-sm font-semibold text-gray-900">CabinetTrack</dd>
              </div>
              <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                <dt className="text-sm font-medium text-gray-500">Version</dt>
                <dd className="text-sm text-gray-700">0.1.0</dd>
              </div>
              <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                <dt className="text-sm font-medium text-gray-500">Stack</dt>
                <dd className="text-sm text-gray-700">Next.js 14 + PostgreSQL</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-sm font-medium text-gray-500">Thème actif</dt>
                <dd className="flex items-center gap-2 text-sm text-gray-700">
                  <span
                    className="inline-block h-3 w-3 rounded-full"
                    style={{ backgroundColor: THEMES[themeKey].sidebar }}
                  />
                  {THEME_LABELS[themeKey]}
                </dd>
              </div>
            </dl>
          </section>
        )}

        {/* ── Tab: Couleur du menu ──────────────────── */}
        {activeTab === "couleur" && (
          <section className="rounded-xl bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-gray-900">Couleur du menu</h2>
            <p className="mt-1 text-sm text-gray-500">
              Choisissez la couleur de la barre latérale. Le changement est instantané.
            </p>

            <div className="mt-5 flex flex-wrap gap-4">
              {THEME_KEYS.map((key) => {
                const theme = THEMES[key]
                const active = key === themeKey
                return (
                  <button
                    key={key}
                    onClick={() => setTheme(key)}
                    className="flex flex-col items-center gap-2"
                    title={THEME_LABELS[key]}
                  >
                    <div
                      className="relative flex h-12 w-12 items-center justify-center rounded-full transition-transform hover:scale-110"
                      style={{
                        backgroundColor: theme.sidebar,
                        boxShadow: active
                          ? `0 0 0 3px #fff, 0 0 0 5px ${theme.accent}`
                          : "0 1px 3px rgba(0,0,0,0.15)",
                      }}
                    >
                      {active && (
                        <svg className="h-5 w-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>
                    <span className="text-xs font-medium text-gray-600">
                      {THEME_LABELS[key]}
                    </span>
                  </button>
                )
              })}
            </div>
          </section>
        )}

        {/* ── Déconnexion ────────────────────────────── */}
        <div className="mt-8 border-t border-gray-200 pt-6">
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="flex items-center gap-2 rounded-lg border border-red-200 bg-white px-4 py-2.5 text-sm font-medium text-red-600 transition-colors hover:bg-red-50"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            Se déconnecter
          </button>
        </div>
      </div>
    </main>
  )
}
