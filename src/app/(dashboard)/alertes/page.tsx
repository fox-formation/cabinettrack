"use client"

import { useState, useEffect, useCallback } from "react"

interface AlerteDossier {
  id: string
  raisonSociale: string
}

interface AlerteEcheance {
  id: string
  libelle: string
  dateEcheance: string
}

interface AlerteData {
  id: string
  titre: string
  message: string
  niveau: "INFO" | "WARNING" | "URGENT" | "CRITIQUE"
  lue: boolean
  acquittee: boolean
  dateAlerte: string
  dossier: AlerteDossier | null
  echeance: AlerteEcheance | null
}

const NIVEAU_CONFIG: Record<string, { label: string; bg: string; text: string; border: string }> = {
  INFO:     { label: "Info",     bg: "bg-blue-50",   text: "text-blue-700",   border: "border-blue-200" },
  WARNING:  { label: "Warning",  bg: "bg-yellow-50", text: "text-yellow-700", border: "border-yellow-200" },
  URGENT:   { label: "Urgent",   bg: "bg-orange-50", text: "text-orange-700", border: "border-orange-200" },
  CRITIQUE: { label: "Critique", bg: "bg-red-50",    text: "text-red-700",    border: "border-red-200" },
}

export default function AlertesPage() {
  const [alertes, setAlertes] = useState<AlerteData[]>([])
  const [loading, setLoading] = useState(true)
  const [filtreNiveau, setFiltreNiveau] = useState("")
  const [filtreStatut, setFiltreStatut] = useState("")
  const [filtreDossier, setFiltreDossier] = useState("")

  const fetchAlertes = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams()
    if (filtreNiveau) params.set("niveau", filtreNiveau)
    if (filtreStatut === "acquittee") params.set("acquittee", "true")
    if (filtreStatut === "en_attente") params.set("acquittee", "false")

    const res = await fetch(`/api/alertes?${params}`)
    if (res.ok) {
      const data: AlerteData[] = await res.json()
      setAlertes(data)
    }
    setLoading(false)
  }, [filtreNiveau, filtreStatut])

  useEffect(() => { fetchAlertes() }, [fetchAlertes])

  const acquitter = async (id: string) => {
    const res = await fetch(`/api/alertes/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ acquittee: true, lue: true }),
    })
    if (res.ok) {
      setAlertes((prev) => prev.map((a) => a.id === id ? { ...a, acquittee: true, lue: true } : a))
    }
  }

  // Dossiers uniques pour le filtre
  const dossiersUniques = Array.from(
    new Map(
      alertes
        .filter((a) => a.dossier)
        .map((a) => [a.dossier!.id, a.dossier!])
    ).values()
  ).sort((a, b) => a.raisonSociale.localeCompare(b.raisonSociale))

  const alertesFiltrees = filtreDossier
    ? alertes.filter((a) => a.dossier?.id === filtreDossier)
    : alertes

  return (
    <main className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Alertes</h1>
        <p className="mt-1 text-sm text-gray-500">
          {alertesFiltrees.length} alerte{alertesFiltrees.length !== 1 ? "s" : ""}
          {filtreStatut === "en_attente" ? " en attente" : ""}
        </p>
      </div>

      {/* Filtres */}
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <select
          value={filtreNiveau}
          onChange={(e) => setFiltreNiveau(e.target.value)}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          <option value="">Tous les niveaux</option>
          <option value="INFO">Info</option>
          <option value="WARNING">Warning</option>
          <option value="URGENT">Urgent</option>
          <option value="CRITIQUE">Critique</option>
        </select>

        <select
          value={filtreStatut}
          onChange={(e) => setFiltreStatut(e.target.value)}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          <option value="">Tous les statuts</option>
          <option value="en_attente">En attente</option>
          <option value="acquittee">Acquittée</option>
        </select>

        <select
          value={filtreDossier}
          onChange={(e) => setFiltreDossier(e.target.value)}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          <option value="">Tous les dossiers</option>
          {dossiersUniques.map((d) => (
            <option key={d.id} value={d.id}>{d.raisonSociale}</option>
          ))}
        </select>

        {(filtreNiveau || filtreStatut || filtreDossier) && (
          <button
            onClick={() => { setFiltreNiveau(""); setFiltreStatut(""); setFiltreDossier("") }}
            className="text-sm text-gray-500 underline hover:text-gray-700"
          >
            Réinitialiser
          </button>
        )}
      </div>

      {/* Liste */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
        </div>
      ) : alertesFiltrees.length === 0 ? (
        <div className="rounded-xl bg-white p-12 text-center shadow-sm">
          <p className="text-gray-500">Aucune alerte</p>
        </div>
      ) : (
        <div className="space-y-3">
          {alertesFiltrees.map((alerte) => {
            const cfg = NIVEAU_CONFIG[alerte.niveau] ?? NIVEAU_CONFIG.INFO
            return (
              <div
                key={alerte.id}
                className={`rounded-xl border bg-white p-4 shadow-sm transition-opacity ${
                  alerte.acquittee ? "opacity-60" : ""
                }`}
              >
                <div className="flex items-start gap-4">
                  {/* Badge niveau */}
                  <span className={`inline-flex shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ${cfg.bg} ${cfg.text}`}>
                    {cfg.label}
                  </span>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className={`font-semibold text-gray-900 ${alerte.acquittee ? "line-through" : ""}`}>
                        {alerte.titre}
                      </h3>
                      {alerte.acquittee && (
                        <span className="rounded bg-green-100 px-1.5 py-0.5 text-[10px] font-medium text-green-700">
                          Acquittée
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-sm text-gray-600">{alerte.message}</p>
                    <div className="mt-2 flex items-center gap-4 text-xs text-gray-400">
                      <span>{new Date(alerte.dateAlerte).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}</span>
                      {alerte.dossier && (
                        <a
                          href={`/dossiers/${alerte.dossier.id}`}
                          className="text-blue-500 hover:text-blue-700 hover:underline"
                        >
                          {alerte.dossier.raisonSociale}
                        </a>
                      )}
                      {alerte.echeance && (
                        <span className="text-gray-400">
                          {alerte.echeance.libelle} — {new Date(alerte.echeance.dateEcheance).toLocaleDateString("fr-FR")}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Bouton acquitter */}
                  {!alerte.acquittee && (
                    <button
                      onClick={() => acquitter(alerte.id)}
                      className="shrink-0 rounded-lg bg-green-50 px-3 py-1.5 text-xs font-medium text-green-700 hover:bg-green-100"
                    >
                      Acquitter
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </main>
  )
}
