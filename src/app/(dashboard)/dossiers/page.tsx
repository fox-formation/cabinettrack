"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import DossiersTabs from "@/components/dossiers/DossiersTabs"
import type { DossierRow, Collaborateur } from "@/components/dossiers/DossiersTabs"
import type { CourantStats } from "@/components/dossiers/DossiersCourantTable"

const ROLE_LABELS: Record<string, string> = {
  ASSISTANT: "Assistant",
  CONFIRME: "Confirmé",
  SUPERVISEUR: "Superviseur",
  EXPERT_COMPTABLE: "Expert-EC",
}

const MOIS = [
  "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre",
]

export default function DossiersListPage() {
  const [allDossiers, setAllDossiers] = useState<DossierRow[]>([])
  const [collaborateurs, setCollaborateurs] = useState<Collaborateur[]>([])
  const [loading, setLoading] = useState(true)

  // Filters
  const [search, setSearch] = useState("")
  const [collabFilter, setCollabFilter] = useState("")
  const [assistantFilter, setAssistantFilter] = useState("")
  const [clotureFilter, setClotureFilter] = useState("")

  // Courant stats (from child)
  const [courantStats, setCourantStats] = useState<CourantStats | null>(null)

  // Tab
  const [tab, setTab] = useState(() => {
    if (typeof window !== "undefined") {
      return new URLSearchParams(window.location.search).get("tab") || "bilan"
    }
    return "bilan"
  })

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/dossiers/list")
      if (res.ok) {
        const data = await res.json()
        setAllDossiers(data.dossiers)
        setCollaborateurs(data.collaborateurs)
      }
    } catch {
      // silent
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  // Reactive filtering
  const filtered = useMemo(() => {
    let result = allDossiers

    // Search
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      result = result.filter((d) => d.raisonSociale.toLowerCase().includes(q))
    }

    // Collaborateur principal
    if (collabFilter) {
      result = result.filter((d) => d.collaborateurPrincipal?.id === collabFilter)
    }

    // Assistant
    if (assistantFilter) {
      result = result.filter((d) => {
        const fa = d.firstAssistant as { id?: string; prenom: string } | null
        return fa && "id" in fa && fa.id === assistantFilter
      })
    }

    // Clôture month — use UTC to avoid timezone shift on @db.Date fields
    if (clotureFilter) {
      const month = parseInt(clotureFilter)
      if (month >= 1 && month <= 12) {
        result = result.filter((d) => {
          if (!d.dateClotureExercice) return false
          return new Date(d.dateClotureExercice).getUTCMonth() + 1 === month
        })
      }
    }

    return result
  }, [allDossiers, search, collabFilter, assistantFilter, clotureFilter])

  // KPIs computed from filtered dossiers
  const kpis = useMemo(() => {
    const total = filtered.length
    const termines = filtered.filter((d) => d.avancement >= 100).length
    const enCours = filtered.filter((d) => d.avancement > 0 && d.avancement < 100).length
    const nonDemarres = filtered.filter((d) => d.avancement === 0).length
    const avgAvancement = total > 0
      ? Math.round(filtered.reduce((s, d) => s + d.avancement, 0) / total)
      : 0
    return { total, termines, enCours, nonDemarres, avgAvancement }
  }, [filtered])

  const hasFilters = search || collabFilter || assistantFilter || clotureFilter

  const resetFilters = () => {
    setSearch("")
    setCollabFilter("")
    setAssistantFilter("")
    setClotureFilter("")
  }

  // Update URL tab
  const handleTabChange = useCallback((key: string) => {
    setTab(key)
    const url = new URL(window.location.href)
    url.searchParams.set("tab", key)
    window.history.replaceState(null, "", url.toString())
  }, [])

  if (loading) {
    return (
      <main className="p-8">
        <div className="flex justify-center py-12">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
        </div>
      </main>
    )
  }

  return (
    <main className="p-8">
      {/* Header with KPIs */}
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-800">Dossiers</h1>
          <p className="text-xs text-gray-400">Liste des dossiers du cabinet</p>
        </div>
        {tab === "courant" && courantStats ? (
          <div className="flex items-center gap-2">
            <div className="rounded border border-gray-200 bg-white px-3 py-1.5 text-center">
              <p className="text-lg font-semibold text-gray-800">{courantStats.total}</p>
              <p className="text-[10px] text-gray-400">Dossiers</p>
            </div>
            <div className="rounded border border-gray-200 bg-white px-3 py-1.5 text-center">
              <p className="text-lg font-semibold text-gray-800">{courantStats.avgAvancement}%</p>
              <p className="text-[10px] text-gray-400">Annuel</p>
              <div className="mt-1 border-t border-gray-100 pt-1">
                <p className="text-sm font-semibold text-gray-700">{courantStats.avgADate}%</p>
                <p className="text-[9px] text-gray-400">A date (fin {MOIS[new Date().getMonth() === 0 ? 11 : new Date().getMonth() - 1]?.slice(0, 3)})</p>
              </div>
            </div>
            <div className="rounded border border-gray-200 bg-white px-3 py-1.5 text-center">
              <p className="text-lg font-semibold text-green-600">{courantStats.termines}</p>
              <p className="text-[10px] text-gray-400">OK</p>
            </div>
            <div className="rounded border border-gray-200 bg-white px-3 py-1.5 text-center">
              <p className="text-lg font-semibold text-amber-600">{courantStats.enCours}</p>
              <p className="text-[10px] text-gray-400">En cours</p>
            </div>
            <div className="rounded border border-gray-200 bg-white px-3 py-1.5 text-center">
              <p className="text-lg font-semibold text-red-600">{courantStats.enRetard}</p>
              <p className="text-[10px] text-gray-400">En retard</p>
            </div>
            <div className="rounded border border-gray-200 bg-white px-3 py-1.5 text-center">
              <p className="text-lg font-semibold text-gray-500">{courantStats.nonDemarres}</p>
              <p className="text-[10px] text-gray-400">Non démarrés</p>
            </div>
          </div>
        ) : tab !== "courant" ? (
          <div className="flex items-center gap-2">
            <div className="rounded border border-gray-200 bg-white px-3 py-1.5 text-center">
              <p className="text-lg font-semibold text-gray-800">{kpis.total}</p>
              <p className="text-[10px] text-gray-400">Dossiers</p>
            </div>
            <div className="rounded border border-gray-200 bg-white px-3 py-1.5 text-center">
              <p className="text-lg font-semibold text-gray-800">{kpis.avgAvancement}%</p>
              <p className="text-[10px] text-gray-400">Avancement</p>
            </div>
            <div className="rounded border border-gray-200 bg-white px-3 py-1.5 text-center">
              <p className="text-lg font-semibold text-green-600">{kpis.termines}</p>
              <p className="text-[10px] text-gray-400">Terminés</p>
            </div>
            <div className="rounded border border-gray-200 bg-white px-3 py-1.5 text-center">
              <p className="text-lg font-semibold text-amber-600">{kpis.enCours}</p>
              <p className="text-[10px] text-gray-400">En cours</p>
            </div>
            <div className="rounded border border-gray-200 bg-white px-3 py-1.5 text-center">
              <p className="text-lg font-semibold text-gray-500">{kpis.nonDemarres}</p>
              <p className="text-[10px] text-gray-400">Non démarrés</p>
            </div>
          </div>
        ) : null}
      </div>

      {/* Filters — reactive, no submit button */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <input
          type="text"
          placeholder="Rechercher..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-56 rounded border border-gray-200 px-3 py-1.5 text-xs text-gray-700 placeholder-gray-400 focus:border-gray-400 focus:outline-none"
        />
        <select
          value={collabFilter}
          onChange={(e) => setCollabFilter(e.target.value)}
          className="rounded border border-gray-200 px-3 py-1.5 text-xs text-gray-600 focus:border-gray-400 focus:outline-none"
        >
          <option value="">Tous les collaborateurs</option>
          {collaborateurs.map((c) => (
            <option key={c.id} value={c.id}>
              {c.prenom} ({ROLE_LABELS[c.role] ?? c.role})
            </option>
          ))}
        </select>
        <select
          value={assistantFilter}
          onChange={(e) => setAssistantFilter(e.target.value)}
          className="rounded border border-gray-200 px-3 py-1.5 text-xs text-gray-600 focus:border-gray-400 focus:outline-none"
        >
          <option value="">Tous les assistants</option>
          {collaborateurs.map((c) => (
            <option key={c.id} value={c.id}>
              {c.prenom} ({ROLE_LABELS[c.role] ?? c.role})
            </option>
          ))}
        </select>
        <select
          value={clotureFilter}
          onChange={(e) => setClotureFilter(e.target.value)}
          className="rounded border border-gray-200 px-3 py-1.5 text-xs text-gray-600 focus:border-gray-400 focus:outline-none"
        >
          <option value="">Toutes les clôtures</option>
          {MOIS.map((m, i) => (
            <option key={i + 1} value={String(i + 1)}>{m}</option>
          ))}
        </select>
        {hasFilters && (
          <button
            onClick={resetFilters}
            className="text-xs text-gray-400 hover:text-gray-600"
          >
            Réinitialiser
          </button>
        )}
      </div>

      {/* Tabs + Table */}
      <DossiersTabs
        dossiers={filtered}
        collaborateurs={collaborateurs}
        defaultTab={tab}
        onTabChange={handleTabChange}
        onCourantStatsChange={setCourantStats}
      />
    </main>
  )
}
