"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"

interface DossierArchive {
  id: string
  raisonSociale: string
  collaborateur: string | null
  cabinet: string
  raisonArchivage: string | null
  dateArchivage: string | null
}

interface ArchivesClientProps {
  dossiers: DossierArchive[]
  raisons: string[]
  filtreRaison: string
}

export default function ArchivesClient({ dossiers, raisons, filtreRaison }: ArchivesClientProps) {
  const router = useRouter()
  const [restoring, setRestoring] = useState<string | null>(null)

  const restaurer = async (id: string) => {
    setRestoring(id)
    const res = await fetch(`/api/dossiers/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ statut: "ACTIF", raisonArchivage: null, dateArchivage: null }),
    })
    if (res.ok) {
      router.refresh()
    }
    setRestoring(null)
  }

  return (
    <>
      {/* Filtre */}
      {raisons.length > 0 && (
        <div className="mb-6">
          <select
            value={filtreRaison}
            onChange={(e) => {
              const val = e.target.value
              const url = val ? `/archives?raison=${encodeURIComponent(val)}` : "/archives"
              router.push(url)
            }}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="">Toutes les raisons</option>
            {raisons.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
        </div>
      )}

      {dossiers.length === 0 ? (
        <div className="rounded-xl bg-white p-12 text-center shadow-sm">
          <p className="text-gray-500">Aucun dossier archivé</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl bg-white shadow-sm">
          <table className="w-full">
            <thead>
              <tr className="border-b bg-gray-50 text-left text-xs font-semibold uppercase text-gray-500">
                <th className="px-4 py-3">Raison sociale</th>
                <th className="px-4 py-3">Collaborateur</th>
                <th className="px-4 py-3">Cabinet</th>
                <th className="px-4 py-3">Raison archivage</th>
                <th className="px-4 py-3">Date archive</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {dossiers.map((d) => (
                <tr key={d.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">{d.raisonSociale}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{d.collaborateur ?? "—"}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{d.cabinet}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{d.raisonArchivage ?? "—"}</td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    {d.dateArchivage
                      ? new Date(d.dateArchivage).toLocaleDateString("fr-FR")
                      : "—"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => restaurer(d.id)}
                      disabled={restoring === d.id}
                      className="rounded-lg bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-100 disabled:opacity-50"
                    >
                      {restoring === d.id ? "..." : "Restaurer"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}
