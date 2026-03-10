"use client"

import { useState, useEffect, useCallback, useRef, useMemo } from "react"
import Link from "next/link"
import type { DossierRow } from "./DossiersTabs"

// ──────────────────────────────────────────────
// Types & constants
// ──────────────────────────────────────────────

interface SuiviCourantData {
  saisieAchat: string | null
  saisieVente: string | null
  paieSaisie: string | null
  lettrage: string | null
  lettrageVente: string | null
  paieRevision: string | null
  compteAttenteOk: string | null
  [key: string]: string | null
}

const TACHES = [
  { key: "saisieAchat",     label: "SACH",  fullLabel: "Saisie achat" },
  { key: "saisieVente",     label: "SVTE",  fullLabel: "Saisie vente" },
  { key: "paieSaisie",      label: "SPAI",  fullLabel: "Saisie paie" },
  { key: "lettrage",        label: "LACH",  fullLabel: "Lettrage achat" },
  { key: "lettrageVente",   label: "LVTE",  fullLabel: "Lettrage vente" },
  { key: "paieRevision",    label: "LPAI",  fullLabel: "Revision paie" },
  { key: "compteAttenteOk", label: "471OK", fullLabel: "Compte attente OK" },
] as const

const NB_TACHES = TACHES.length

const PAIE_KEYS = new Set(["paieSaisie", "paieRevision"])

function getTaches(paie: boolean) {
  return paie ? TACHES : TACHES.filter((t) => !PAIE_KEYS.has(t.key))
}

const MOIS_LONG = [
  "Janvier", "Fevrier", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Aout", "Septembre", "Octobre", "Novembre", "Decembre",
]

const STATUT_CYCLE: (string | null)[] = [null, "QUART", "DEMI", "EN_COURS", "EFFECTUE"]
const BULK_CYCLE: (string | null)[] = [null, "QUART", "DEMI", "EN_COURS", "EFFECTUE"]

const STATUT_PCT: Record<string, number> = {
  QUART: 25, DEMI: 50, EN_COURS: 75, EFFECTUE: 100,
}

function statutToPct(val: string | null): number {
  if (!val) return 0
  return STATUT_PCT[val] ?? 0
}

function nextStatut(current: string | null): string | null {
  const idx = STATUT_CYCLE.indexOf(current)
  return STATUT_CYCLE[(idx + 1) % STATUT_CYCLE.length]
}

function fmtPeriode(y: number, m: number): string {
  return `${y}-${String(m + 1).padStart(2, "0")}`
}

function monthAvancement(suivi: SuiviCourantData | undefined, paie = true): number {
  if (!suivi) return 0
  const taches = getTaches(paie)
  let total = 0
  for (const t of taches) total += statutToPct(suivi[t.key])
  return Math.round(total / taches.length)
}

function isComplete(suivi: SuiviCourantData | undefined, paie = true): boolean {
  return monthAvancement(suivi, paie) === 100
}

function hasAnyStarted(suivi: SuiviCourantData | undefined, paie = true): boolean {
  if (!suivi) return false
  return getTaches(paie).some((t) => suivi[t.key] != null)
}

// ──────────────────────────────────────────────
// Exercise offset helpers
// ──────────────────────────────────────────────

function getClotureMois(dateClotureExercice: string | null): number {
  if (!dateClotureExercice) return 11
  return new Date(dateClotureExercice).getUTCMonth()
}

function getM1Mois(clotureMois: number): number {
  return (clotureMois + 1) % 12
}

function exerciseMonthToCalendar(
  moisExercice: number, m1Mois: number, exerciseYear: number,
): { year: number; month: number } {
  const calMonth = (m1Mois + moisExercice - 1) % 12
  const yearOffset = Math.floor((m1Mois + moisExercice - 1) / 12)
  return { year: exerciseYear + yearOffset, month: calMonth }
}

function getCurrentExerciseYear(now: Date, m1Mois: number): number {
  if (now.getMonth() < m1Mois) return now.getFullYear() - 1
  return now.getFullYear()
}

function getCurrentExerciseMonth(now: Date, m1Mois: number): number {
  return ((now.getMonth() - m1Mois + 12) % 12) + 1
}

// ──────────────────────────────────────────────
// Main component
// ──────────────────────────────────────────────

const EMPTY_SUIVI: SuiviCourantData = {
  saisieAchat: null, saisieVente: null, paieSaisie: null,
  lettrage: null, lettrageVente: null, paieRevision: null,
  compteAttenteOk: null,
}

export interface CourantStats {
  total: number
  termines: number
  enCours: number
  nonDemarres: number
  enRetard: number
  avgAvancement: number
  avgADate: number
}

const MISSION_FILTERS = [
  { key: "SAISIE_MENSUELLE", label: "Saisie mensuelle", defaultOn: true },
  { key: "SAISIE_TRIMESTRIELLE", label: "Saisie trimestrielle", defaultOn: true },
  { key: "SAISIE_SEMESTRIELLE", label: "Saisie semestrielle", defaultOn: true },
  { key: "SAISIE_ANNUELLE", label: "Saisie annuelle", defaultOn: false },
  { key: "SAISIE", label: "Saisie", defaultOn: true },
  { key: "_NULL_", label: "Non renseigné", defaultOn: true },
] as const

const DEFAULT_MISSIONS = new Set(
  MISSION_FILTERS.filter((m) => m.defaultOn).map((m) => m.key)
)

interface Props {
  dossiers: DossierRow[]
  onStatsChange?: (stats: CourantStats) => void
}

export default function DossiersCourantTable({ dossiers, onStatsChange }: Props) {
  const now = useMemo(() => new Date(), [])
  const nowPeriode = fmtPeriode(now.getFullYear(), now.getMonth())

  const [mensuel, setMensuel] = useState(false)
  const [activeMissions, setActiveMissions] = useState<Set<string>>(() => new Set(DEFAULT_MISSIONS))
  const [avancementMax, setAvancementMax] = useState<number | null>(null) // null = all, 0/25/50/75
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  const toggleMission = useCallback((key: string) => {
    setActiveMissions((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }, [])

  // Filter dossiers by selected mission types
  const filteredDossiers = useMemo(() => {
    return dossiers.filter((d) => {
      const missionKey = d.typeMission ?? "_NULL_"
      return activeMissions.has(missionKey)
    })
  }, [dossiers, activeMissions])

  // Count dossiers per mission type (for badge display)
  const missionCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const d of dossiers) {
      const key = d.typeMission ?? "_NULL_"
      counts[key] = (counts[key] ?? 0) + 1
    }
    return counts
  }, [dossiers])

  // Compute all 12 exercise month periodes for every dossier
  const allPeriodesAndMeta = useMemo(() => {
    const periodesSet = new Set<string>()
    const perDossier: Record<string, {
      clotureMois: number
      m1Mois: number
      exerciseYear: number
      allYearPeriodes: string[]   // 12 calendar periodes (M1..M12)
      allYearCalLabels: string[]  // calendar labels
    }> = {}

    for (const d of filteredDossiers) {
      const clotureMois = getClotureMois(d.dateClotureExercice)
      const m1Mois = getM1Mois(clotureMois)
      const exerciseYear = getCurrentExerciseYear(now, m1Mois)

      const allYearPeriodes: string[] = []
      const allYearCalLabels: string[] = []
      for (let ex = 1; ex <= 12; ex++) {
        const cal = exerciseMonthToCalendar(ex, m1Mois, exerciseYear)
        const p = fmtPeriode(cal.year, cal.month)
        allYearPeriodes.push(p)
        allYearCalLabels.push(`${MOIS_LONG[cal.month]} ${cal.year}`)
        periodesSet.add(p)
      }

      perDossier[d.id] = { clotureMois, m1Mois, exerciseYear, allYearPeriodes, allYearCalLabels }
    }

    return { periodesSet, perDossier }
  }, [filteredDossiers, now])

  const allPeriodes = useMemo(
    () => Array.from(allPeriodesAndMeta.periodesSet).sort(),
    [allPeriodesAndMeta.periodesSet],
  )

  const [suivis, setSuivis] = useState<Record<string, Record<string, SuiviCourantData>>>({})
  const [loading, setLoading] = useState(true)
  const [popover, setPopover] = useState<{
    dossierId: string
    periode: string
    exMonth: number
    calLabel: string
    anchorRect: DOMRect
  } | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const periodesKey = allPeriodes.join(",")

  useEffect(() => {
    if (!periodesKey) return
    setLoading(true)
    fetch(`/api/suivi-courant?periodes=${periodesKey}`)
      .then((r) => r.json())
      .then((data: { suivis: Record<string, Record<string, SuiviCourantData>> }) => {
        setSuivis(data.suivis)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [periodesKey])

  const patchField = useCallback(
    (dossierId: string, periode: string, field: string, value: string | null) => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(() => {
        fetch("/api/suivi-courant", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ dossierId, periode, field, value }),
        })
      }, 150)
    },
    [],
  )

  const patchBulk = useCallback(
    (dossierId: string, periode: string, fields: Record<string, string | null>) => {
      fetch("/api/suivi-courant", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dossierId, periode, fields }),
      })
    },
    [],
  )

  const toggleTache = useCallback(
    (dossierId: string, periode: string, field: string) => {
      setSuivis((prev) => {
        const dossierSuivis = { ...(prev[dossierId] ?? {}) }
        const current: SuiviCourantData = dossierSuivis[periode] ?? { ...EMPTY_SUIVI }
        const newVal = nextStatut(current[field])
        const updated = { ...current, [field]: newVal }
        dossierSuivis[periode] = updated
        patchField(dossierId, periode, field, newVal)
        return { ...prev, [dossierId]: dossierSuivis }
      })
    },
    [patchField],
  )

  const bulkSetAll = useCallback(
    (dossierId: string, periode: string, value: string | null) => {
      setSuivis((prev) => {
        const dossierSuivis = { ...(prev[dossierId] ?? {}) }
        const current: SuiviCourantData = dossierSuivis[periode] ?? { ...EMPTY_SUIVI }
        const fields: Record<string, string | null> = {}
        const updated = { ...current }
        for (const t of TACHES) {
          updated[t.key] = value
          fields[t.key] = value
        }
        dossierSuivis[periode] = updated
        patchBulk(dossierId, periode, fields)
        return { ...prev, [dossierId]: dossierSuivis }
      })
    },
    [patchBulk],
  )

  const cycleBulkNext = useCallback(
    (dossierId: string, periode: string) => {
      setSuivis((prev) => {
        const dossierSuivis = { ...(prev[dossierId] ?? {}) }
        const current: SuiviCourantData = dossierSuivis[periode] ?? { ...EMPTY_SUIVI }
        let maxIdx = 0
        for (const t of TACHES) {
          const idx = BULK_CYCLE.indexOf(current[t.key])
          if (idx > maxIdx) maxIdx = idx
        }
        const nextIdx = (maxIdx + 1) % BULK_CYCLE.length
        const nextVal = BULK_CYCLE[nextIdx]
        const fields: Record<string, string | null> = {}
        const updated = { ...current }
        for (const t of TACHES) {
          updated[t.key] = nextVal
          fields[t.key] = nextVal
        }
        dossierSuivis[periode] = updated
        patchBulk(dossierId, periode, fields)
        return { ...prev, [dossierId]: dossierSuivis }
      })
    },
    [patchBulk],
  )

  // ── Multi-select helpers (used after displayDossiers is defined) ──
  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  // ── Computed stats (reactive) ──
  const stats = useMemo(() => {
    let termines = 0, enCours = 0, nonDemarres = 0, enRetard = 0
    let totalAv = 0
    let totalADate = 0, countADate = 0

    for (const d of filteredDossiers) {
      const dSuivis = suivis[d.id] ?? {}
      const meta = allPeriodesAndMeta.perDossier[d.id]
      if (!meta) continue

      // Annual avancement for this dossier
      let dossierTotalPct = 0
      for (const p of meta.allYearPeriodes) {
        dossierTotalPct += monthAvancement(dSuivis[p], d.paie)
      }
      const dossierAv = Math.round(dossierTotalPct / 12)
      totalAv += dossierAv

      // A date avancement (elapsed months only)
      const curExMonth = getCurrentExerciseMonth(now, meta.m1Mois)
      const nbMoisEcoules = curExMonth - 1
      if (nbMoisEcoules > 0) {
        let aDatePct = 0
        for (let i = 0; i < nbMoisEcoules; i++) {
          aDatePct += monthAvancement(dSuivis[meta.allYearPeriodes[i]], d.paie)
        }
        totalADate += Math.round(aDatePct / nbMoisEcoules)
        countADate++
      }

      // Current month status
      const curCal = exerciseMonthToCalendar(curExMonth, meta.m1Mois, meta.exerciseYear)
      const curPeriode = fmtPeriode(curCal.year, curCal.month)
      const curSuivi = dSuivis[curPeriode]
      if (isComplete(curSuivi, d.paie)) termines++
      else if (hasAnyStarted(curSuivi, d.paie)) enCours++
      else nonDemarres++

      // Retard
      for (const p of meta.allYearPeriodes) {
        if (p < nowPeriode && !isComplete(dSuivis[p], d.paie)) { enRetard++; break }
      }
    }

    const avgAvancement = filteredDossiers.length > 0 ? Math.round(totalAv / filteredDossiers.length) : 0
    const avgADate = countADate > 0 ? Math.round(totalADate / countADate) : 0
    return { total: filteredDossiers.length, termines, enCours, nonDemarres, enRetard, avgAvancement, avgADate }
  }, [filteredDossiers, suivis, allPeriodesAndMeta, now, nowPeriode])

  // Notify parent of stats changes
  useEffect(() => {
    if (onStatsChange) onStatsChange(stats)
  }, [stats, onStatsChange])

  // ── Avancement filter (display only, stats stay on full filteredDossiers) ──
  const displayDossiers = useMemo(() => {
    if (avancementMax === null) return filteredDossiers
    return filteredDossiers.filter((d) => {
      const dSuivis = suivis[d.id] ?? {}
      const meta = allPeriodesAndMeta.perDossier[d.id]
      if (!meta) return true
      let totalPct = 0
      for (const p of meta.allYearPeriodes) totalPct += monthAvancement(dSuivis[p], d.paie)
      const av = Math.round(totalPct / 12)
      return av <= avancementMax
    })
  }, [filteredDossiers, suivis, allPeriodesAndMeta, avancementMax])

  // ── Multi-select bulk actions (after displayDossiers) ──
  const toggleSelectAll = useCallback(() => {
    setSelectedIds((prev) => {
      if (prev.size === displayDossiers.length) return new Set()
      return new Set(displayDossiers.map((d) => d.id))
    })
  }, [displayDossiers])

  const bulkSetSelected = useCallback(
    (value: string | null) => {
      if (selectedIds.size === 0) return
      const ids = Array.from(selectedIds)
      setSuivis((prev) => {
        const next = { ...prev }
        for (const dossierId of ids) {
          const meta = allPeriodesAndMeta.perDossier[dossierId]
          if (!meta) continue
          const curExMonth = getCurrentExerciseMonth(now, meta.m1Mois)
          const cal = exerciseMonthToCalendar(curExMonth, meta.m1Mois, meta.exerciseYear)
          const periode = fmtPeriode(cal.year, cal.month)

          const dossierSuivis = { ...(next[dossierId] ?? {}) }
          const current: SuiviCourantData = dossierSuivis[periode] ?? { ...EMPTY_SUIVI }
          const fields: Record<string, string | null> = {}
          const updated = { ...current }
          for (const t of TACHES) {
            updated[t.key] = value
            fields[t.key] = value
          }
          dossierSuivis[periode] = updated
          next[dossierId] = dossierSuivis
          patchBulk(dossierId, periode, fields)
        }
        return next
      })
    },
    [selectedIds, allPeriodesAndMeta, now, patchBulk],
  )

  // ── Per-dossier helpers ──
  function getRetardMois(dossierId: string, paie: boolean): string[] {
    const dSuivis = suivis[dossierId] ?? {}
    const meta = allPeriodesAndMeta.perDossier[dossierId]
    if (!meta) return []
    const retards: string[] = []
    for (let ex = 1; ex <= 12; ex++) {
      const cal = exerciseMonthToCalendar(ex, meta.m1Mois, meta.exerciseYear)
      const p = fmtPeriode(cal.year, cal.month)
      if (p < nowPeriode && !isComplete(dSuivis[p], paie)) retards.push(`M${ex}`)
    }
    return retards
  }

  function getAnnualAvancement(dossierId: string, paie: boolean): number {
    const dSuivis = suivis[dossierId] ?? {}
    const meta = allPeriodesAndMeta.perDossier[dossierId]
    if (!meta) return 0
    let totalPct = 0
    for (const p of meta.allYearPeriodes) totalPct += monthAvancement(dSuivis[p], paie)
    return Math.round(totalPct / 12)
  }

  // Avancement des mois écoulés (M1 à M(n-1) où n = mois d'exercice en cours)
  function getAvancementADate(dossierId: string, paie: boolean): { pct: number; nbMois: number } {
    const dSuivis = suivis[dossierId] ?? {}
    const meta = allPeriodesAndMeta.perDossier[dossierId]
    if (!meta) return { pct: 0, nbMois: 0 }
    const curExMonth = getCurrentExerciseMonth(now, meta.m1Mois) // 1-based
    const nbMoisEcoules = curExMonth - 1 // mois complètement écoulés
    if (nbMoisEcoules <= 0) return { pct: 0, nbMois: 0 }
    let totalPct = 0
    for (let i = 0; i < nbMoisEcoules; i++) {
      totalPct += monthAvancement(dSuivis[meta.allYearPeriodes[i]], paie)
    }
    return { pct: Math.round(totalPct / nbMoisEcoules), nbMois: nbMoisEcoules }
  }

  function getTrimestreAvancement(dossierId: string, tri: number, paie: boolean): number {
    const dSuivis = suivis[dossierId] ?? {}
    const meta = allPeriodesAndMeta.perDossier[dossierId]
    if (!meta) return 0
    let total = 0
    for (let i = 0; i < 3; i++) {
      const p = meta.allYearPeriodes[tri * 3 + i]
      if (p) total += monthAvancement(dSuivis[p], paie)
    }
    return Math.round(total / 3)
  }

  function formatCloture(dateClotureExercice: string | null): string {
    if (!dateClotureExercice) return "31/12"
    const d = new Date(dateClotureExercice)
    return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`
  }

  // ── Column definitions ──
  const columns = mensuel
    ? Array.from({ length: 12 }, (_, i) => ({ exMonth: i + 1, label: `M${i + 1}` }))
    : [
        { tri: 0, label: "T1" },
        { tri: 1, label: "T2" },
        { tri: 2, label: "T3" },
        { tri: 3, label: "T4" },
      ]

  return (
    <>
      {/* View toggle + mission filters */}
      <div className="mb-3 flex items-start justify-between">
        <div className="flex items-center gap-2">
          <label className="flex cursor-pointer items-center gap-1.5 rounded border border-gray-200 bg-white px-2.5 py-1 text-xs">
            <input
              type="checkbox"
              checked={mensuel}
              onChange={(e) => setMensuel(e.target.checked)}
              className="h-3 w-3 rounded border-gray-300 text-gray-600 focus:ring-gray-400"
            />
            <span className="text-gray-600">Vue mensuelle</span>
          </label>
          <span className="text-[10px] text-gray-400">
            {mensuel ? "M1-M12" : "T1-T4"}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-x-3 gap-y-0.5">
          {MISSION_FILTERS.map((m) => {
            const count = missionCounts[m.key] ?? 0
            if (count === 0) return null
            return (
              <label key={m.key} className="flex cursor-pointer items-center gap-1 text-[10px]">
                <input
                  type="checkbox"
                  checked={activeMissions.has(m.key)}
                  onChange={() => toggleMission(m.key)}
                  className="h-3 w-3 rounded border-gray-300 text-gray-600 focus:ring-gray-400"
                />
                <span className="text-gray-500">{m.label}</span>
                <span className="text-[9px] text-gray-300">({count})</span>
              </label>
            )
          })}
        </div>
      </div>

      {/* Bulk action bar */}
      {selectedIds.size > 0 && (
        <div className="mb-2 flex items-center gap-2 rounded border border-blue-200 bg-blue-50 px-3 py-2">
          <span className="text-xs font-medium text-blue-700">
            {selectedIds.size} dossier{selectedIds.size > 1 ? "s" : ""} sélectionné{selectedIds.size > 1 ? "s" : ""}
          </span>
          <span className="text-gray-300">|</span>
          <span className="text-[10px] text-gray-500">Mois en cours →</span>
          {(["QUART", "DEMI", "EN_COURS", "EFFECTUE"] as const).map((val) => (
            <button
              key={val}
              onClick={() => bulkSetSelected(val)}
              className="rounded border border-gray-200 bg-white px-2 py-1 text-[10px] font-medium text-gray-600 transition-colors hover:bg-gray-100"
            >
              {STATUT_PCT[val]}%
            </button>
          ))}
          <button
            onClick={() => bulkSetSelected(null)}
            className="rounded border border-gray-200 bg-white px-2 py-1 text-[10px] font-medium text-red-500 transition-colors hover:bg-red-50"
          >
            Reset 0%
          </button>
          <button
            onClick={() => setSelectedIds(new Set())}
            className="ml-auto text-[10px] text-gray-400 hover:text-gray-600"
          >
            Désélectionner
          </button>
        </div>
      )}

      {/* Matrix table */}
      <div className="overflow-x-auto rounded border border-gray-200 bg-white">
        <table className="w-full text-xs">
          <thead className="border-b border-gray-200 text-left text-[10px] font-medium uppercase tracking-wide text-gray-400">
            <tr>
              <th className="px-1 py-2 text-center">
                <input
                  type="checkbox"
                  checked={displayDossiers.length > 0 && selectedIds.size === displayDossiers.length}
                  onChange={toggleSelectAll}
                  className="h-3 w-3 rounded border-gray-300 text-blue-600 focus:ring-blue-400"
                />
              </th>
              <th className="sticky left-0 z-10 bg-white px-3 py-2">Dossier</th>
              <th className="px-2 py-2">Collab.</th>
              <th className="px-2 py-1">
                <div className="flex flex-col items-center gap-0.5">
                  <span>Avanc.</span>
                  <select
                    value={avancementMax === null ? "" : String(avancementMax)}
                    onChange={(e) => setAvancementMax(e.target.value === "" ? null : Number(e.target.value))}
                    className="w-14 rounded border border-gray-200 px-1 py-0.5 text-[9px] font-normal normal-case text-gray-500 focus:border-gray-400 focus:outline-none"
                  >
                    <option value="">Tous</option>
                    <option value="0">= 0%</option>
                    <option value="25">&le; 25%</option>
                    <option value="50">&le; 50%</option>
                    <option value="75">&le; 75%</option>
                  </select>
                </div>
              </th>
              <th className="px-2 py-2 text-center">Retard</th>
              {columns.map((col, i) => (
                <th key={i} className="px-1 py-2 text-center">
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr>
                <td colSpan={5 + columns.length} className="px-4 py-8 text-center">
                  <div className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
                </td>
              </tr>
            ) : (
              displayDossiers.map((d) => {
                const dSuivis = suivis[d.id] ?? {}
                const meta = allPeriodesAndMeta.perDossier[d.id]
                if (!meta) return null
                const annualAv = getAnnualAvancement(d.id, d.paie)
                const retards = getRetardMois(d.id, d.paie)
                return (
                  <tr key={d.id} className={`group transition-colors ${selectedIds.has(d.id) ? "bg-blue-50/40" : "hover:bg-gray-50/60"}`}>
                    <td className="px-1 py-1.5 text-center">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(d.id)}
                        onChange={() => toggleSelect(d.id)}
                        className="h-3 w-3 rounded border-gray-300 text-blue-600 focus:ring-blue-400"
                      />
                    </td>
                    <td className={`sticky left-0 z-10 px-3 py-1.5 ${selectedIds.has(d.id) ? "bg-blue-50/40" : "bg-white group-hover:bg-gray-50/60"}`}>
                      <Link href={`/dossiers/${d.id}`} className="font-medium text-gray-800 hover:text-blue-600 hover:underline text-xs">
                        {d.raisonSociale}
                      </Link>
                      <span className={`ml-1 text-[9px] font-mono ${
                        meta.clotureMois !== 11 ? "text-amber-600" : "text-gray-300"
                      }`}>
                        {formatCloture(d.dateClotureExercice)}
                      </span>
                    </td>
                    <td className="px-2 py-1.5 text-xs text-gray-500">
                      {d.collaborateurPrincipal?.prenom ?? <span className="text-gray-300">-</span>}
                    </td>
                    <td className="px-2 py-1.5">
                      <div className="flex items-center justify-center gap-1">
                        <div className="h-1 w-8 rounded-full bg-gray-200">
                          <div
                            className={`h-1 rounded-full transition-all ${
                              annualAv >= 100 ? "bg-green-500" : annualAv > 50 ? "bg-amber-400" : "bg-gray-400"
                            }`}
                            style={{ width: `${Math.min(annualAv, 100)}%` }}
                          />
                        </div>
                        <span className={`text-[10px] font-medium tabular-nums ${
                          annualAv >= 100 ? "text-green-600" : annualAv > 50 ? "text-amber-600" : annualAv > 0 ? "text-gray-600" : "text-gray-400"
                        }`}>{annualAv}%</span>
                      </div>
                    </td>
                    <td className="px-2 py-1.5 text-center">
                      {retards.length > 0 ? (
                        <span className="text-[9px] font-medium text-red-500">
                          {retards.length > 3 ? `${retards.length} mois` : retards.join(", ")}
                        </span>
                      ) : (
                        <span className="text-[10px] text-gray-300">-</span>
                      )}
                    </td>
                    {mensuel ? (
                      // Monthly columns M1..M12
                      Array.from({ length: 12 }, (_, exIdx) => {
                        const p = meta.allYearPeriodes[exIdx]
                        const suivi = dSuivis[p]
                        const pct = monthAvancement(suivi, d.paie)
                        return (
                          <td key={exIdx} className="px-0.5 py-1.5">
                            <div className="flex items-center justify-center gap-0.5">
                              <button
                                onClick={() => cycleBulkNext(d.id, p)}
                                className={`rounded px-1 py-0.5 text-[10px] font-medium tabular-nums transition-colors ${
                                  pct >= 100
                                    ? "text-green-600 hover:bg-gray-100"
                                    : pct > 0
                                      ? "text-amber-600 hover:bg-gray-100"
                                      : "text-gray-300 hover:bg-gray-100"
                                }`}
                                title={`M${exIdx + 1} — ${meta.allYearCalLabels[exIdx]}\nClic = niveau suivant`}
                              >
                                {pct}%
                              </button>
                              <button
                                onClick={(e) => {
                                  const rect = e.currentTarget.getBoundingClientRect()
                                  setPopover(
                                    popover?.dossierId === d.id && popover?.periode === p
                                      ? null
                                      : { dossierId: d.id, periode: p, exMonth: exIdx + 1, calLabel: meta.allYearCalLabels[exIdx], anchorRect: rect }
                                  )
                                }}
                                className="rounded p-0.5 text-gray-300 hover:bg-gray-100 hover:text-gray-500"
                                title="Detail"
                              >
                                <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                </svg>
                              </button>
                            </div>
                          </td>
                        )
                      })
                    ) : (
                      // Trimester columns T1..T4 — clickable to expand months
                      [0, 1, 2, 3].map((tri) => {
                        const triPct = getTrimestreAvancement(d.id, tri, d.paie)
                        const triMonthIndices = [tri * 3, tri * 3 + 1, tri * 3 + 2]
                        return (
                          <td key={tri} className="px-0.5 py-1.5">
                            <div className="flex items-center justify-center gap-px">
                              {triMonthIndices.map((exIdx) => {
                                const p = meta.allYearPeriodes[exIdx]
                                const suivi = dSuivis[p]
                                const pct = monthAvancement(suivi, d.paie)
                                return (
                                  <button
                                    key={exIdx}
                                    onClick={(e) => {
                                      const rect = e.currentTarget.getBoundingClientRect()
                                      setPopover(
                                        popover?.dossierId === d.id && popover?.periode === p
                                          ? null
                                          : { dossierId: d.id, periode: p, exMonth: exIdx + 1, calLabel: meta.allYearCalLabels[exIdx], anchorRect: rect }
                                      )
                                    }}
                                    className={`rounded px-1 py-0.5 text-[9px] font-medium tabular-nums transition-colors hover:bg-gray-100 ${
                                      pct >= 100
                                        ? "text-green-600"
                                        : pct > 0
                                          ? "text-amber-600"
                                          : "text-gray-300"
                                    }`}
                                    title={`M${exIdx + 1} — ${meta.allYearCalLabels[exIdx]}\nClic = detail par tache`}
                                  >
                                    {pct}
                                  </button>
                                )
                              })}
                              <span className={`ml-0.5 text-[10px] font-medium tabular-nums ${
                                triPct >= 100
                                  ? "text-green-600"
                                  : triPct >= 50
                                    ? "text-amber-600"
                                    : triPct > 0
                                      ? "text-gray-600"
                                      : "text-gray-300"
                              }`}>
                                {triPct}%
                              </span>
                            </div>
                          </td>
                        )
                      })
                    )}
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Popover */}
      {popover && (
        <TachePopover
          dossierId={popover.dossierId}
          periode={popover.periode}
          exMonth={popover.exMonth}
          calLabel={popover.calLabel}
          anchorRect={popover.anchorRect}
          suivi={suivis[popover.dossierId]?.[popover.periode]}
          dossierName={displayDossiers.find((d) => d.id === popover.dossierId)?.raisonSociale ?? ""}
          paie={displayDossiers.find((d) => d.id === popover.dossierId)?.paie ?? true}
          onToggle={(field) => toggleTache(popover.dossierId, popover.periode, field)}
          onBulkSet={(value) => bulkSetAll(popover.dossierId, popover.periode, value)}
          onClose={() => setPopover(null)}
        />
      )}
    </>
  )
}

// ──────────────────────────────────────────────
// Tache popover with 4-level + bulk buttons
// ──────────────────────────────────────────────

const NIVEAU_DISPLAY: Record<string, { icon: string; label: string; text: string; badge: string }> = {
  QUART:    { icon: "\u25CB", label: "25%",  text: "text-gray-600",                  badge: "text-gray-400" },
  DEMI:     { icon: "\u25CB", label: "50%",  text: "text-gray-600",                  badge: "text-gray-500" },
  EN_COURS: { icon: "\u25CB", label: "75%",  text: "text-amber-600",                 badge: "text-amber-500" },
  EFFECTUE: { icon: "\u2713", label: "100%", text: "text-green-600 line-through",     badge: "text-green-600" },
}

const DEFAULT_DISPLAY = { icon: "\u2022", label: "0%", text: "text-gray-400", badge: "text-gray-300" }

function TachePopover({
  dossierId,
  periode,
  exMonth,
  calLabel,
  anchorRect,
  suivi,
  dossierName,
  paie,
  onToggle,
  onBulkSet,
  onClose,
}: {
  dossierId: string
  periode: string
  exMonth: number
  calLabel: string
  anchorRect: DOMRect
  suivi: SuiviCourantData | undefined
  dossierName: string
  paie: boolean
  onToggle: (field: string) => void
  onBulkSet: (value: string | null) => void
  onClose: () => void
}) {
  const popRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (popRef.current && !popRef.current.contains(e.target as Node)) onClose()
    }
    const escHandler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    document.addEventListener("mousedown", handler)
    document.addEventListener("keydown", escHandler)
    return () => {
      document.removeEventListener("mousedown", handler)
      document.removeEventListener("keydown", escHandler)
    }
  }, [onClose])

  const top = anchorRect.bottom + 8
  const left = Math.max(8, anchorRect.left + anchorRect.width / 2 - 150)
  const pct = monthAvancement(suivi, paie)
  const taches = getTaches(paie)

  return (
    <div
      ref={popRef}
      className="fixed z-50 w-[260px] rounded border border-gray-200 bg-white shadow-lg"
      style={{ top: `${top}px`, left: `${left}px` }}
    >
      <div className="border-b border-gray-100 px-3 py-2">
        <p className="truncate text-xs font-medium text-gray-700">{dossierName}</p>
        <p className="text-[10px] text-gray-400">
          M{exMonth} &mdash; {calLabel} &mdash; {pct}%
        </p>
      </div>

      <div className="flex gap-1.5 border-b border-gray-100 px-3 py-1.5">
        <button
          onClick={() => onBulkSet("EN_COURS")}
          className="flex-1 rounded border border-gray-200 px-2 py-1 text-[10px] font-medium text-amber-600 hover:bg-gray-50 transition-colors"
        >
          Tout 75%
        </button>
        <button
          onClick={() => onBulkSet("EFFECTUE")}
          className="flex-1 rounded border border-gray-200 px-2 py-1 text-[10px] font-medium text-green-600 hover:bg-gray-50 transition-colors"
        >
          Tout 100%
        </button>
        <button
          onClick={() => onBulkSet(null)}
          className="rounded border border-gray-200 px-2 py-1 text-[10px] font-medium text-gray-400 hover:bg-gray-50 transition-colors"
          title="RAZ"
        >
          RAZ
        </button>
      </div>

      <div className="space-y-px p-1.5">
        {taches.map((t) => {
          const val = suivi?.[t.key] ?? null
          const display = val ? NIVEAU_DISPLAY[val] ?? DEFAULT_DISPLAY : DEFAULT_DISPLAY
          return (
            <button
              key={t.key}
              onClick={() => onToggle(t.key)}
              className="flex w-full items-center gap-2 rounded px-2.5 py-1.5 text-left transition-colors hover:bg-gray-50"
            >
              <span className={`text-xs ${display.text}`}>{display.icon}</span>
              <span className={`flex-1 text-[11px] ${display.text}`}>
                {t.fullLabel}
              </span>
              <span className={`text-[9px] font-medium tabular-nums ${display.badge}`}>
                {display.label}
              </span>
            </button>
          )
        })}
      </div>

      <div className="border-t border-gray-100 px-3 py-1.5">
        <p className="text-[9px] text-gray-300">
          Cliquer pour cycler : 0% &rarr; 25% &rarr; 50% &rarr; 75% &rarr; 100% &rarr; 0%
        </p>
      </div>
    </div>
  )
}
