"use client"

import { useState, useMemo } from "react"
import DossiersTable from "./DossiersTable"
import DossiersCourantTable from "./DossiersCourantTable"
import type { CourantStats } from "./DossiersCourantTable"
import DossiersTachesTable from "./DossiersTachesTable"
import DossiersRevisionTable from "./DossiersRevisionTable"

export interface DossierRow {
  id: string
  raisonSociale: string
  collaborateurPrincipal: { id: string; prenom: string; role: string } | null
  firstAssistant: { id?: string; prenom: string } | null
  datePrevueArreteBilan: string | null
  dateArreteBilan: string | null
  dateClotureExercice: string | null
  avancement: number
  etapeStatuts: (string | null)[]
  typeMission: string | null
  paie: boolean
  commentaireBilan: string | null
}

export interface Collaborateur {
  id: string
  prenom: string
  role: string
}

interface DossiersTabsProps {
  dossiers: DossierRow[]
  collaborateurs: Collaborateur[]
  defaultTab: string
  onTabChange?: (key: string) => void
  onCourantStatsChange?: (stats: CourantStats) => void
}

const TABS = [
  { key: "bilan", label: "Bilan" },
  { key: "courant", label: "Courant" },
  { key: "revision", label: "Révision" },
  { key: "taches", label: "Tâches exceptionnelles" },
] as const

export default function DossiersTabs({ dossiers, collaborateurs, defaultTab, onTabChange, onCourantStatsChange }: DossiersTabsProps) {
  const [activeTab, setActiveTab] = useState(
    TABS.find((t) => t.key === defaultTab) ? defaultTab : "bilan"
  )

  // Dossiers en révision pure (sans courant) = typeMission === "REVISION"
  const revisionDossiers = useMemo(
    () => dossiers.filter((d) => d.typeMission === "REVISION"),
    [dossiers]
  )
  const nonRevisionDossiers = useMemo(
    () => dossiers.filter((d) => d.typeMission !== "REVISION"),
    [dossiers]
  )

  const handleTabChange = (key: string) => {
    setActiveTab(key)
    if (onTabChange) {
      onTabChange(key)
    } else {
      const url = new URL(window.location.href)
      url.searchParams.set("tab", key)
      window.history.replaceState(null, "", url.toString())
    }
  }

  return (
    <>
      {/* Tab bar */}
      <div className="mb-3 flex gap-px border-b border-gray-200">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => handleTabChange(tab.key)}
            className={`px-4 py-1.5 text-xs font-medium transition-colors ${
              activeTab === tab.key
                ? "border-b-2 border-gray-700 text-gray-800"
                : "text-gray-400 hover:text-gray-600"
            }`}
          >
            {tab.label}
            {tab.key === "revision" && revisionDossiers.length > 0 && (
              <span className="ml-1 text-[9px] text-gray-400">
                ({revisionDossiers.length})
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === "bilan" && <DossiersTable dossiers={dossiers} />}
      {activeTab === "courant" && <DossiersCourantTable dossiers={nonRevisionDossiers} onStatsChange={onCourantStatsChange} />}
      {activeTab === "revision" && (
        <DossiersRevisionTable dossiers={revisionDossiers} collaborateurs={collaborateurs} />
      )}
      {activeTab === "taches" && <DossiersTachesTable dossiers={dossiers} />}
    </>
  )
}
