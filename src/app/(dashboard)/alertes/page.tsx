"use client"

import { useState, useEffect, useCallback } from "react"
import Link from "next/link"

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

// Obligation categories for columns
const OBLIGATION_COLS = [
  { key: "TVA", label: "TVA", match: (l: string) => l.includes("TVA") || l.includes("CA3") || l.includes("CA12") },
  { key: "IS", label: "IS / Liasse", match: (l: string) => l.includes("IS") || l.includes("Liasse") || l.includes("2065") },
  { key: "AGO", label: "AGO", match: (l: string) => l.includes("AGO") || l.includes("Approbation") },
  { key: "DAS2", label: "DAS 2", match: (l: string) => l.includes("DAS") },
  { key: "CVAE", label: "CVAE", match: (l: string) => l.includes("CVAE") },
  { key: "CFE", label: "CFE", match: (l: string) => l.includes("CFE") },
  { key: "GREFFE", label: "Greffe", match: (l: string) => l.includes("Greffe") || l.includes("greffe") || l.includes("Dépôt") },
  { key: "2572", label: "2572", match: (l: string) => l.includes("2572") },
  { key: "AUTRE", label: "Autres", match: () => true },
] as const

function classifyEcheance(libelle: string): string {
  for (const col of OBLIGATION_COLS) {
    if (col.key !== "AUTRE" && col.match(libelle)) return col.key
  }
  return "AUTRE"
}

function joursRetard(dateEcheance: string): number {
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  const d = new Date(dateEcheance)
  d.setHours(0, 0, 0, 0)
  return Math.floor((now.getTime() - d.getTime()) / 86400000)
}

interface DossierRow {
  dossierId: string
  raisonSociale: string
  collaborateur: string
  cabinet: string
  echeances: Map<string, EcheanceRetard[]>
  maxRetard: number
}

export default function AlertesPage() {
  const [echeances, setEcheances] = useState<EcheanceRetard[]>([])
  const [loading, setLoading] = useState(true)
  const [filtreType, setFiltreType] = useState("")
  const [filtreRetardOnly, setFiltreRetardOnly] = useState(false)

  const fetchRetards = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/echeances/retards")
      if (res.ok) {
        const data: EcheanceRetard[] = await res.json()
        setEcheances(data)
      }
    } catch { /* empty */ }
    setLoading(false)
  }, [])

  useEffect(() => { fetchRetards() }, [fetchRetards])

  const markAsFait = useCallback(async (echeanceId: string) => {
    setEcheances((prev) => prev.filter((e) => e.id !== echeanceId))
    await fetch(`/api/echeances/${echeanceId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ statut: "FAIT" }),
    })
  }, [])

  // Build dossier rows
  const dossierMap = new Map<string, DossierRow>()
  for (const ech of echeances) {
    const jours = joursRetard(ech.dateEcheance)
    if (filtreRetardOnly && jours < 0) continue
    if (filtreType && ech.type !== filtreType) continue

    const key = ech.dossier.id
    if (!dossierMap.has(key)) {
      dossierMap.set(key, {
        dossierId: ech.dossier.id,
        raisonSociale: ech.dossier.raisonSociale,
        collaborateur: ech.dossier.collaborateurPrincipal?.prenom ?? "-",
        cabinet: ech.dossier.cabinet.nom,
        echeances: new Map(),
        maxRetard: 0,
      })
    }
    const row = dossierMap.get(key)!
    const category = classifyEcheance(ech.libelle)
    if (!row.echeances.has(category)) row.echeances.set(category, [])
    row.echeances.get(category)!.push(ech)
    if (jours > row.maxRetard) row.maxRetard = jours
  }

  const rows = Array.from(dossierMap.values()).sort((a, b) => b.maxRetard - a.maxRetard)

  const totalRetard = echeances.filter((e) => joursRetard(e.dateEcheance) > 0).length
  const totalAVenir = echeances.filter((e) => joursRetard(e.dateEcheance) <= 0).length

  return (
    <main className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Alertes — Retards et Échéances</h1>
        <p className="mt-1 text-sm text-gray-500">
          {totalRetard} en retard · {totalAVenir} à venir · {rows.length} dossier{rows.length > 1 ? "s" : ""} concerné{rows.length > 1 ? "s" : ""}
        </p>
      </div>

      {/* Stats */}
      <div className="mb-6 grid grid-cols-3 gap-4">
        <div className="rounded-xl border border-red-200 bg-red-50 p-4">
          <p className="text-xs font-medium text-red-600">En retard</p>
          <p className="mt-1 text-2xl font-bold text-red-700">{totalRetard}</p>
        </div>
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-xs font-medium text-amber-600">À venir (7j)</p>
          <p className="mt-1 text-2xl font-bold text-amber-700">
            {echeances.filter((e) => { const j = joursRetard(e.dateEcheance); return j <= 0 && j >= -7 }).length}
          </p>
        </div>
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
          <p className="text-xs font-medium text-blue-600">Total échéances ouvertes</p>
          <p className="mt-1 text-2xl font-bold text-blue-700">{echeances.length}</p>
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
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-xl bg-white p-12 text-center shadow-sm">
          <p className="text-lg font-medium text-gray-400">Aucune échéance en attente</p>
          <p className="mt-1 text-sm text-gray-400">Tous les dossiers sont à jour</p>
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
                    const echs = row.echeances.get(col.key)
                    if (!echs || echs.length === 0) {
                      return (
                        <td key={col.key} className="px-2 py-2 text-center">
                          <span className="text-gray-200">—</span>
                        </td>
                      )
                    }
                    return (
                      <td key={col.key} className="px-1 py-1.5">
                        <div className="flex flex-col gap-1">
                          {echs.map((ech) => {
                            const jours = joursRetard(ech.dateEcheance)
                            const isOverdue = jours > 0
                            const isUrgent = jours >= 0 && jours <= 7
                            return (
                              <button
                                key={ech.id}
                                onClick={() => markAsFait(ech.id)}
                                title={`${ech.libelle}\n${new Date(ech.dateEcheance).toLocaleDateString("fr-FR")}\nCliquer pour marquer comme FAIT`}
                                className={`group relative rounded px-1.5 py-1 text-center text-[10px] font-medium transition-all ${
                                  isOverdue
                                    ? "border border-red-200 bg-red-50 text-red-700 hover:bg-green-50 hover:text-green-700 hover:border-green-300"
                                    : isUrgent
                                      ? "border border-amber-200 bg-amber-50 text-amber-700 hover:bg-green-50 hover:text-green-700 hover:border-green-300"
                                      : "border border-blue-200 bg-blue-50 text-blue-700 hover:bg-green-50 hover:text-green-700 hover:border-green-300"
                                }`}
                              >
                                <span className="group-hover:hidden">
                                  {isOverdue ? `J+${jours}` : jours === 0 ? "Auj." : `J-${Math.abs(jours)}`}
                                </span>
                                <span className="hidden group-hover:inline">
                                  ✓ Fait
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
    </main>
  )
}
