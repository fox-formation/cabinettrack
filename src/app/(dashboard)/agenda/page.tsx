"use client"

import { useState, useEffect, useCallback } from "react"

interface EcheanceDossier {
  id: string
  raisonSociale: string
  collaborateurPrincipal: { id: string; prenom: string } | null
  cabinet: { id: string; nom: string }
  regimeTva: string | null
  regimeFiscal: string | null
}

interface EcheanceData {
  id: string
  libelle: string
  type: "FISCALE" | "SOCIALE" | "JURIDIQUE"
  dateEcheance: string
  statut: "A_FAIRE" | "EN_COURS" | "FAIT" | "NON_APPLICABLE"
  commentaire: string | null
  dossier: EcheanceDossier
}

interface AgendaResponse {
  periode: { from: string; to: string }
  stats: { total: number; aFaire: number; enCours: number; fait: number }
  parJour: Record<string, EcheanceData[]>
  echeances: EcheanceData[]
}

const TYPE_COLORS: Record<string, { bg: string; text: string; dot: string }> = {
  FISCALE:   { bg: "bg-blue-50",   text: "text-blue-700",   dot: "bg-blue-500" },
  SOCIALE:   { bg: "bg-green-50",  text: "text-green-700",  dot: "bg-green-500" },
  JURIDIQUE: { bg: "bg-purple-50", text: "text-purple-700", dot: "bg-purple-500" },
}

const STATUT_LABELS: Record<string, { label: string; class: string }> = {
  A_FAIRE:         { label: "A faire",         class: "bg-red-100 text-red-700" },
  EN_COURS:        { label: "En cours",        class: "bg-yellow-100 text-yellow-700" },
  FAIT:            { label: "Fait",            class: "bg-green-100 text-green-700" },
  NON_APPLICABLE:  { label: "N/A",             class: "bg-gray-100 text-gray-500" },
}

const JOURS_FR = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"]
const MOIS_FR = [
  "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"
]

function getCalendarDays(year: number, month: number) {
  const firstDay = new Date(year, month, 1)
  const lastDay = new Date(year, month + 1, 0)
  // Monday = 0, Sunday = 6
  let startOffset = (firstDay.getDay() + 6) % 7
  const days: (number | null)[] = []
  for (let i = 0; i < startOffset; i++) days.push(null)
  for (let d = 1; d <= lastDay.getDate(); d++) days.push(d)
  while (days.length % 7 !== 0) days.push(null)
  return days
}

interface CollabOption {
  id: string
  prenom: string
  role: string
}

export default function AgendaPage() {
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth())
  const [data, setData] = useState<AgendaResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<EcheanceData | null>(null)
  const [collaborateurs, setCollaborateurs] = useState<CollabOption[]>([])
  const [collabFilter, setCollabFilter] = useState("")

  // Charger la liste des collaborateurs une seule fois
  useEffect(() => {
    fetch("/api/collaborateurs")
      .then((r) => r.ok ? r.json() : [])
      .then((list) => setCollaborateurs(list))
      .catch(() => {})
  }, [])

  const fetchAgenda = useCallback(async () => {
    setLoading(true)
    const mois = `${year}-${String(month + 1).padStart(2, "0")}`
    const params = new URLSearchParams({ mois })
    if (collabFilter) params.set("userId", collabFilter)
    const res = await fetch(`/api/agenda?${params}`)
    if (res.ok) {
      setData(await res.json())
    }
    setLoading(false)
  }, [year, month, collabFilter])

  useEffect(() => { fetchAgenda() }, [fetchAgenda])

  const prevMonth = () => {
    if (month === 0) { setMonth(11); setYear(year - 1) }
    else setMonth(month - 1)
  }
  const nextMonth = () => {
    if (month === 11) { setMonth(0); setYear(year + 1) }
    else setMonth(month + 1)
  }

  const days = getCalendarDays(year, month)
  const today = new Date()
  const isToday = (d: number) =>
    d === today.getDate() && month === today.getMonth() && year === today.getFullYear()

  // Build events by day number
  const eventsByDay: Record<number, EcheanceData[]> = {}
  if (data?.echeances) {
    for (const ech of data.echeances) {
      const d = new Date(ech.dateEcheance).getDate()
      if (!eventsByDay[d]) eventsByDay[d] = []
      eventsByDay[d].push(ech)
    }
  }

  return (
    <main className="p-8">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Agenda</h1>
          {data && (
            <p className="mt-1 text-sm text-gray-500">
              {data.stats.total} échéance{data.stats.total !== 1 ? "s" : ""} —{" "}
              <span className="text-red-600">{data.stats.aFaire} à faire</span>,{" "}
              <span className="text-yellow-600">{data.stats.enCours} en cours</span>,{" "}
              <span className="text-green-600">{data.stats.fait} fait</span>
            </p>
          )}
        </div>
        <div className="flex items-center gap-3">
          <select
            value={collabFilter}
            onChange={(e) => setCollabFilter(e.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
          >
            <option value="">Tous les collaborateurs</option>
            {collaborateurs.map((c) => (
              <option key={c.id} value={c.id}>{c.prenom}</option>
            ))}
          </select>
          <button
            onClick={prevMonth}
            className="rounded-lg border border-gray-300 p-2 text-gray-600 hover:bg-gray-50"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <span className="min-w-[180px] text-center text-lg font-semibold text-gray-900">
            {MOIS_FR[month]} {year}
          </span>
          <button
            onClick={nextMonth}
            className="rounded-lg border border-gray-300 p-2 text-gray-600 hover:bg-gray-50"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
        </div>
      ) : (
        <div className="rounded-xl bg-white shadow-sm">
          {/* Days header */}
          <div className="grid grid-cols-7 border-b">
            {JOURS_FR.map((j) => (
              <div key={j} className="px-2 py-3 text-center text-xs font-semibold uppercase text-gray-500">
                {j}
              </div>
            ))}
          </div>

          {/* Calendar grid */}
          <div className="grid grid-cols-7">
            {days.map((day, i) => {
              const events = day ? eventsByDay[day] ?? [] : []
              return (
                <div
                  key={i}
                  className={`min-h-[100px] border-b border-r p-1.5 ${
                    day ? "bg-white" : "bg-gray-50"
                  } ${i % 7 === 0 ? "border-l" : ""}`}
                >
                  {day && (
                    <>
                      <div
                        className={`mb-1 flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium ${
                          isToday(day) ? "bg-blue-600 text-white" : "text-gray-700"
                        }`}
                      >
                        {day}
                      </div>
                      <div className="space-y-0.5">
                        {events.slice(0, 3).map((ech) => {
                          const tc = TYPE_COLORS[ech.type] ?? TYPE_COLORS.FISCALE
                          return (
                            <button
                              key={ech.id}
                              onClick={() => setSelected(ech)}
                              className={`flex w-full items-center gap-1 rounded px-1 py-0.5 text-left text-[10px] font-medium ${tc.bg} ${tc.text} hover:opacity-80`}
                            >
                              <span className={`inline-block h-1.5 w-1.5 shrink-0 rounded-full ${tc.dot}`} />
                              <span className="truncate">{ech.libelle}</span>
                            </button>
                          )
                        })}
                        {events.length > 3 && (
                          <span className="block text-center text-[10px] text-gray-400">
                            +{events.length - 3}
                          </span>
                        )}
                      </div>
                    </>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Drawer détail */}
      {selected && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/30"
            onClick={() => setSelected(null)}
          />
          <div className="fixed right-0 top-0 z-50 flex h-full w-[400px] flex-col bg-white shadow-2xl">
            <div className="border-b px-6 py-4">
              <div className="flex items-start justify-between">
                <div className="min-w-0 flex-1">
                  <h2 className="text-lg font-bold text-gray-900">{selected.libelle}</h2>
                  <div className="mt-2 flex items-center gap-2">
                    {(() => {
                      const tc = TYPE_COLORS[selected.type] ?? TYPE_COLORS.FISCALE
                      return (
                        <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${tc.bg} ${tc.text}`}>
                          {selected.type}
                        </span>
                      )
                    })()}
                    {(() => {
                      const sc = STATUT_LABELS[selected.statut] ?? STATUT_LABELS.A_FAIRE
                      return (
                        <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${sc.class}`}>
                          {sc.label}
                        </span>
                      )
                    })()}
                  </div>
                </div>
                <button
                  onClick={() => setSelected(null)}
                  className="ml-4 rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                >
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-6 space-y-4">
              <div>
                <label className="text-xs font-medium uppercase text-gray-400">Date échéance</label>
                <p className="mt-1 text-sm font-semibold text-gray-900">
                  {new Date(selected.dateEcheance).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
                </p>
              </div>

              <div>
                <label className="text-xs font-medium uppercase text-gray-400">Dossier</label>
                <a
                  href={`/dossiers/${selected.dossier.id}`}
                  className="mt-1 block text-sm font-semibold text-blue-600 hover:underline"
                >
                  {selected.dossier.raisonSociale}
                </a>
              </div>

              {selected.dossier.collaborateurPrincipal && (
                <div>
                  <label className="text-xs font-medium uppercase text-gray-400">Collaborateur</label>
                  <p className="mt-1 text-sm text-gray-700">{selected.dossier.collaborateurPrincipal.prenom}</p>
                </div>
              )}

              <div>
                <label className="text-xs font-medium uppercase text-gray-400">Cabinet</label>
                <p className="mt-1 text-sm text-gray-700">{selected.dossier.cabinet.nom}</p>
              </div>

              {selected.dossier.regimeFiscal && (
                <div>
                  <label className="text-xs font-medium uppercase text-gray-400">Régime fiscal</label>
                  <p className="mt-1 text-sm text-gray-700">{selected.dossier.regimeFiscal}</p>
                </div>
              )}

              {selected.commentaire && (
                <div>
                  <label className="text-xs font-medium uppercase text-gray-400">Commentaire</label>
                  <p className="mt-1 text-sm text-gray-700">{selected.commentaire}</p>
                </div>
              )}
            </div>

            <div className="border-t px-6 py-4">
              <a
                href={`/dossiers/${selected.dossier.id}`}
                className="block w-full rounded-lg bg-blue-600 px-4 py-2.5 text-center text-sm font-medium text-white hover:bg-blue-700"
              >
                Voir le dossier complet
              </a>
            </div>
          </div>
        </>
      )}
    </main>
  )
}
