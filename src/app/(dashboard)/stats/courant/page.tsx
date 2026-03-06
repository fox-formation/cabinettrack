"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
import Link from "next/link"
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  BarChart, Bar, Cell,
} from "recharts"

// ── Types ──────────────────────────────────────────

interface StatsData {
  year: number
  totalDossiers: number
  kpi: {
    avgGlobal: number
    dossiers100: number
    dossiersEnRetard: number
    tachePlusIncomplete: { key: string; label: string; count: number }
  }
  monthlyGlobal: { moisExercice: number; avgPct: number }[]
  collabTable: {
    id: string
    prenom: string
    nbDossiers: number
    months: number[]
    global: number
  }[]
  cabinetMonths: number[]
  cabinetGlobal: number
  tacheStats: {
    key: string
    label: string
    effectue: number
    enCours: number
    aucun: number
  }[]
  collabList: {
    id: string
    prenom: string
    months: number[]
  }[]
}

// ── Color palette for collaborateurs ──────────────

const COLLAB_COLORS = [
  "#3b82f6", "#ef4444", "#10b981", "#f59e0b", "#8b5cf6",
  "#ec4899", "#06b6d4", "#84cc16", "#f97316", "#6366f1",
]

function cellColor(pct: number): string {
  if (pct >= 100) return "bg-green-100 text-green-800"
  if (pct >= 50) return "bg-orange-100 text-orange-800"
  if (pct > 0) return "bg-red-100 text-red-800"
  return "text-gray-300"
}

// ── Component ──────────────────────────────────────

export default function StatsCourantPage() {
  const currentYear = new Date().getFullYear()
  const [year, setYear] = useState(currentYear)
  const [data, setData] = useState<StatsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [collabFilter, setCollabFilter] = useState("")
  const [visibleCollabs, setVisibleCollabs] = useState<Set<string>>(new Set())

  const fetchData = useCallback(async (y: number) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/stats/courant?year=${y}`)
      if (res.ok) {
        const json = await res.json()
        setData(json)
        // Show all collabs by default
        setVisibleCollabs(new Set(json.collabList.map((c: { id: string }) => c.id)))
      }
    } catch {
      // silent
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData(year)
  }, [year, fetchData])

  // Line chart data: M1..M12 with global + per-collab curves
  const lineData = useMemo(() => {
    if (!data) return []
    return data.monthlyGlobal.map((m, i) => {
      const point: Record<string, number | string> = {
        name: `M${m.moisExercice}`,
        Cabinet: m.avgPct,
      }
      for (const c of data.collabList) {
        point[c.prenom] = c.months[i]
      }
      return point
    })
  }, [data])

  // Bar chart data: stacked per tâche
  const barData = useMemo(() => {
    if (!data) return []
    return data.tacheStats.map((t) => {
      const total = t.effectue + t.enCours + t.aucun
      return {
        name: t.label,
        Effectue: total > 0 ? Math.round((t.effectue / total) * 100) : 0,
        EnCours: total > 0 ? Math.round((t.enCours / total) * 100) : 0,
        NonCommence: total > 0 ? Math.round((t.aucun / total) * 100) : 0,
      }
    })
  }, [data])

  // Filtered collab table
  const filteredCollabTable = useMemo(() => {
    if (!data) return []
    if (!collabFilter) return data.collabTable
    return data.collabTable.filter((c) => c.id === collabFilter)
  }, [data, collabFilter])

  if (loading && !data) {
    return (
      <main className="p-8">
        <p className="text-gray-400">Chargement des statistiques courant...</p>
      </main>
    )
  }

  if (!data) {
    return (
      <main className="p-8">
        <p className="text-gray-500">Erreur de chargement.</p>
      </main>
    )
  }

  return (
    <main className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Statistiques — Suivi courant</h1>
        <p className="text-sm text-gray-500">Avancement des tâches courantes par exercice</p>
      </div>

      {/* Sub-nav */}
      <div className="mb-6 flex gap-4">
        <Link href="/stats/structure" className="rounded-lg border bg-white px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50">
          Structure
        </Link>
        <Link href="/stats/avancement" className="rounded-lg border bg-white px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50">
          Avancement
        </Link>
        <Link href="/stats/courant" className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white">
          Courant
        </Link>
      </div>

      {/* Filters */}
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <select
          value={year}
          onChange={(e) => setYear(Number(e.target.value))}
          className="rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-blue-500 focus:outline-none"
        >
          {[currentYear - 1, currentYear, currentYear + 1].map((y) => (
            <option key={y} value={y}>Exercice {y}</option>
          ))}
        </select>
        <select
          value={collabFilter}
          onChange={(e) => setCollabFilter(e.target.value)}
          className="rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-blue-500 focus:outline-none"
        >
          <option value="">Tous les collaborateurs</option>
          {data.collabTable.map((c) => (
            <option key={c.id} value={c.id}>{c.prenom}</option>
          ))}
        </select>
        {(collabFilter || year !== currentYear) && (
          <button
            onClick={() => { setCollabFilter(""); setYear(currentYear) }}
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            Réinitialiser
          </button>
        )}
      </div>

      {/* Section 1: KPI Cards */}
      <div className="mb-6 grid grid-cols-4 gap-4">
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <p className="text-sm text-gray-500">Avancement global</p>
          <p className="mt-1 text-3xl font-bold text-gray-900">{data.kpi.avgGlobal}%</p>
          <p className="mt-1 text-xs text-gray-400">{data.totalDossiers} dossiers courants</p>
        </div>
        <div className="rounded-lg border border-green-200 bg-green-50 p-4">
          <p className="text-sm text-green-600">100% à jour</p>
          <p className="mt-1 text-3xl font-bold text-green-700">{data.kpi.dossiers100}</p>
          <p className="mt-1 text-xs text-green-500">dossiers complets</p>
        </div>
        <div className="rounded-lg border border-red-200 bg-red-50 p-4">
          <p className="text-sm text-red-600">En retard</p>
          <p className="mt-1 text-3xl font-bold text-red-700">{data.kpi.dossiersEnRetard}</p>
          <p className="mt-1 text-xs text-red-400">tâches incomplètes</p>
        </div>
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
          <p className="text-sm text-amber-600">Tâche bloquante</p>
          <p className="mt-1 text-xl font-bold text-amber-800">
            {data.kpi.tachePlusIncomplete.label || "—"}
          </p>
          {data.kpi.tachePlusIncomplete.count > 0 && (
            <p className="mt-1 text-xs text-amber-500">
              bloque {data.kpi.tachePlusIncomplete.count} dossiers
            </p>
          )}
        </div>
      </div>

      {/* Section 2: Line Chart - Evolution */}
      <div className="mb-6 rounded-lg border border-gray-200 bg-white p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
            Courbe d&apos;évolution — % avancement par mois d&apos;exercice
          </h2>
          <div className="flex flex-wrap gap-2">
            {data.collabList.map((c, i) => (
              <button
                key={c.id}
                onClick={() => {
                  setVisibleCollabs((prev) => {
                    const next = new Set(prev)
                    if (next.has(c.id)) next.delete(c.id)
                    else next.add(c.id)
                    return next
                  })
                }}
                className={`rounded px-2 py-0.5 text-xs transition-colors ${
                  visibleCollabs.has(c.id)
                    ? "font-medium text-white"
                    : "bg-gray-100 text-gray-400"
                }`}
                style={visibleCollabs.has(c.id) ? { backgroundColor: COLLAB_COLORS[i % COLLAB_COLORS.length] } : {}}
              >
                {c.prenom}
              </button>
            ))}
          </div>
        </div>
        <ResponsiveContainer width="100%" height={320}>
          <LineChart data={lineData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="name" tick={{ fontSize: 12 }} />
            <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} tickFormatter={(v) => `${v}%`} />
            <Tooltip formatter={(value) => `${value}%`} />
            <Legend />
            <Line
              type="monotone"
              dataKey="Cabinet"
              stroke="#1f2937"
              strokeWidth={3}
              dot={{ r: 4 }}
            />
            {data.collabList.map((c, i) =>
              visibleCollabs.has(c.id) ? (
                <Line
                  key={c.id}
                  type="monotone"
                  dataKey={c.prenom}
                  stroke={COLLAB_COLORS[i % COLLAB_COLORS.length]}
                  strokeWidth={1.5}
                  dot={{ r: 2 }}
                  strokeDasharray="5 5"
                />
              ) : null
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Section 3: Bar Chart - Stacked per tâche */}
      <div className="mb-6 rounded-lg border border-gray-200 bg-white p-6">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-500">
          Répartition par tâche (tous dossiers, tous mois)
        </h2>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={barData} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 12 }} tickFormatter={(v) => `${v}%`} />
            <YAxis type="category" dataKey="name" tick={{ fontSize: 12 }} width={60} />
            <Tooltip formatter={(value) => `${value}%`} />
            <Legend />
            <Bar dataKey="Effectue" stackId="a" name="Effectué" fill="#22c55e">
              {barData.map((_, i) => (
                <Cell key={i} fill="#22c55e" />
              ))}
            </Bar>
            <Bar dataKey="EnCours" stackId="a" name="En cours" fill="#f59e0b">
              {barData.map((_, i) => (
                <Cell key={i} fill="#f59e0b" />
              ))}
            </Bar>
            <Bar dataKey="NonCommence" stackId="a" name="Non commencé" fill="#e5e7eb">
              {barData.map((_, i) => (
                <Cell key={i} fill="#e5e7eb" />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Section 4: Collaborateur Detail Table */}
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-500">
          Détail par collaborateur — % moyen par mois d&apos;exercice
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-xs font-medium uppercase text-gray-500">
                <th className="px-3 py-2 text-left">Collaborateur</th>
                <th className="px-2 py-2 text-center">Doss.</th>
                {Array.from({ length: 12 }, (_, i) => (
                  <th key={i} className="px-2 py-2 text-center">M{i + 1}</th>
                ))}
                <th className="px-3 py-2 text-center font-bold">Global</th>
              </tr>
            </thead>
            <tbody>
              {filteredCollabTable.map((c) => (
                <tr key={c.id} className="border-b hover:bg-gray-50">
                  <td className="px-3 py-2 font-medium text-gray-900">{c.prenom}</td>
                  <td className="px-2 py-2 text-center text-gray-500">{c.nbDossiers}</td>
                  {c.months.map((pct, i) => (
                    <td key={i} className="px-2 py-2 text-center">
                      <span className={`inline-block w-10 rounded px-1 py-0.5 text-xs font-medium ${cellColor(pct)}`}>
                        {pct > 0 ? `${pct}%` : "—"}
                      </span>
                    </td>
                  ))}
                  <td className="px-3 py-2 text-center">
                    <span className={`inline-block rounded px-2 py-0.5 text-xs font-bold ${cellColor(c.global)}`}>
                      {c.global}%
                    </span>
                  </td>
                </tr>
              ))}
              {/* Cabinet synthesis row */}
              <tr className="border-t-2 border-gray-300 bg-gray-50 font-bold">
                <td className="px-3 py-2 text-gray-900">CABINET</td>
                <td className="px-2 py-2 text-center text-gray-500">{data.totalDossiers}</td>
                {data.cabinetMonths.map((pct, i) => (
                  <td key={i} className="px-2 py-2 text-center">
                    <span className={`inline-block w-10 rounded px-1 py-0.5 text-xs font-bold ${cellColor(pct)}`}>
                      {pct > 0 ? `${pct}%` : "—"}
                    </span>
                  </td>
                ))}
                <td className="px-3 py-2 text-center">
                  <span className={`inline-block rounded px-2 py-0.5 text-xs font-bold ${cellColor(data.cabinetGlobal)}`}>
                    {data.cabinetGlobal}%
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </main>
  )
}
