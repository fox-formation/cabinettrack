"use client"

import { useState, useEffect, useCallback, useMemo } from "react"

interface CollaborateurData {
  id: string
  numero: string | null
  prenom: string
  nom: string
  email: string | null
  role: "ASSISTANT" | "CONFIRME" | "SUPERVISEUR" | "EXPERT_COMPTABLE"
  statut: "ACTIF" | "ARCHIVE"
  dateArrivee: string | null
  dateFinContrat: string | null
  createdAt: string
  _count: {
    dossiersPrincipaux: number
    dossiersSecondaires: number
  }
}

const ROLE_CONFIG: Record<string, { label: string; bg: string; text: string }> = {
  ASSISTANT:        { label: "Assistant",        bg: "bg-gray-100",   text: "text-gray-700" },
  CONFIRME:         { label: "Confirmé",         bg: "bg-blue-100",   text: "text-blue-700" },
  SUPERVISEUR:      { label: "Chef de mission",  bg: "bg-purple-100", text: "text-purple-700" },
  EXPERT_COMPTABLE: { label: "Expert-comptable", bg: "bg-amber-100",  text: "text-amber-700" },
}

const ROLES = [
  { value: "ASSISTANT", label: "Assistant" },
  { value: "CONFIRME", label: "Confirmé" },
  { value: "SUPERVISEUR", label: "Chef de mission" },
  { value: "EXPERT_COMPTABLE", label: "Expert-comptable" },
]

function formatDate(d: string | null): string {
  if (!d) return "—"
  return new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" })
}

function toInputDate(d: string | null): string {
  if (!d) return ""
  return new Date(d).toISOString().split("T")[0]
}

export default function CollaborateursPage() {
  const [collaborateurs, setCollaborateurs] = useState<CollaborateurData[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editCollab, setEditCollab] = useState<CollaborateurData | null>(null)
  const [form, setForm] = useState({ prenom: "", nom: "", email: "", role: "ASSISTANT", dateArrivee: "" })
  const [error, setError] = useState("")
  const [saving, setSaving] = useState(false)

  // Archive modal
  const [archiveTarget, setArchiveTarget] = useState<CollaborateurData | null>(null)
  const [archiveDateFin, setArchiveDateFin] = useState("")
  const [archiving, setArchiving] = useState(false)

  // Delete confirm
  const [deleteTarget, setDeleteTarget] = useState<CollaborateurData | null>(null)
  const [deleting, setDeleting] = useState(false)

  // Filter
  const [showArchived, setShowArchived] = useState(false)

  const fetchCollaborateurs = useCallback(async () => {
    setLoading(true)
    const res = await fetch("/api/collaborateurs")
    if (res.ok) setCollaborateurs(await res.json())
    setLoading(false)
  }, [])

  useEffect(() => { fetchCollaborateurs() }, [fetchCollaborateurs])

  const actifs = useMemo(() => collaborateurs.filter((c) => c.statut === "ACTIF"), [collaborateurs])
  const archives = useMemo(() => collaborateurs.filter((c) => c.statut === "ARCHIVE"), [collaborateurs])
  const displayed = showArchived ? archives : actifs

  const openCreate = () => {
    setEditCollab(null)
    setForm({ prenom: "", nom: "", email: "", role: "ASSISTANT", dateArrivee: "" })
    setError("")
    setShowModal(true)
  }

  const openEdit = (c: CollaborateurData) => {
    setEditCollab(c)
    setForm({
      prenom: c.prenom,
      nom: c.nom || "",
      email: c.email || "",
      role: c.role,
      dateArrivee: toInputDate(c.dateArrivee),
    })
    setError("")
    setShowModal(true)
  }

  const closeModal = () => {
    setShowModal(false)
    setEditCollab(null)
    setError("")
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    if (!form.prenom.trim()) { setError("Le prénom est requis"); return }

    setSaving(true)
    const payload = {
      prenom: form.prenom,
      nom: form.nom,
      email: form.email,
      role: form.role,
      dateArrivee: form.dateArrivee || null,
    }

    const url = editCollab ? `/api/collaborateurs/${editCollab.id}` : "/api/collaborateurs"
    const method = editCollab ? "PATCH" : "POST"
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })

    if (res.ok) {
      closeModal()
      fetchCollaborateurs()
    } else {
      const data = await res.json()
      setError(data.error || "Erreur")
    }
    setSaving(false)
  }

  // Archive
  const handleArchive = async () => {
    if (!archiveTarget) return
    setArchiving(true)
    const res = await fetch(`/api/collaborateurs/${archiveTarget.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        statut: "ARCHIVE",
        dateFinContrat: archiveDateFin || null,
      }),
    })
    if (res.ok) {
      setArchiveTarget(null)
      setArchiveDateFin("")
      fetchCollaborateurs()
    }
    setArchiving(false)
  }

  // Réactiver
  const handleReactivate = async (c: CollaborateurData) => {
    await fetch(`/api/collaborateurs/${c.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ statut: "ACTIF", dateFinContrat: null }),
    })
    fetchCollaborateurs()
  }

  // Delete
  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    const res = await fetch(`/api/collaborateurs/${deleteTarget.id}`, { method: "DELETE" })
    if (res.ok) {
      setDeleteTarget(null)
      fetchCollaborateurs()
    }
    setDeleting(false)
  }

  return (
    <main className="p-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Collaborateurs</h1>
          <p className="mt-1 text-sm text-gray-500">
            {actifs.length} actif{actifs.length !== 1 ? "s" : ""}
            {archives.length > 0 && <span className="text-gray-400"> · {archives.length} archivé{archives.length !== 1 ? "s" : ""}</span>}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {archives.length > 0 && (
            <button
              onClick={() => setShowArchived(!showArchived)}
              className={`rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${
                showArchived
                  ? "border-gray-400 bg-gray-100 text-gray-700"
                  : "border-gray-200 text-gray-500 hover:bg-gray-50"
              }`}
            >
              {showArchived ? "Voir actifs" : `Voir archivés (${archives.length})`}
            </button>
          )}
          <button
            onClick={openCreate}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            + Ajouter
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
        </div>
      ) : displayed.length === 0 ? (
        <div className="rounded-xl bg-white p-12 text-center shadow-sm">
          <p className="text-gray-500">{showArchived ? "Aucun collaborateur archivé" : "Aucun collaborateur"}</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {displayed.map((c) => {
            const rc = ROLE_CONFIG[c.role] ?? ROLE_CONFIG.ASSISTANT
            const isArchived = c.statut === "ARCHIVE"
            return (
              <div key={c.id} className={`group rounded-xl bg-white p-5 shadow-sm ${isArchived ? "opacity-70" : ""}`}>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold ${
                      isArchived ? "bg-gray-200 text-gray-400" : "bg-gray-100 text-gray-600"
                    }`}>
                      {c.prenom[0]}{c.nom ? c.nom[0] : ""}
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900">
                        {c.prenom} {c.nom}
                        {c.numero && (
                          <span className="ml-2 rounded bg-gray-100 px-1.5 py-0.5 text-xs font-mono font-medium text-gray-500">
                            {c.numero}
                          </span>
                        )}
                      </h3>
                      {c.email && (
                        <p className="text-xs text-gray-500">{c.email}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${rc.bg} ${rc.text}`}>
                      {rc.label}
                    </span>
                    {isArchived && (
                      <span className="rounded-full bg-red-100 px-2 py-1 text-xs font-bold text-red-600">
                        Archivé
                      </span>
                    )}
                  </div>
                </div>

                {/* Dates */}
                <div className="mt-3 flex gap-4 text-xs text-gray-500">
                  <span>Arrivée : {formatDate(c.dateArrivee)}</span>
                  {c.dateFinContrat && <span>Fin : {formatDate(c.dateFinContrat)}</span>}
                </div>

                {/* Dossiers count */}
                <div className="mt-3 flex items-center gap-4 text-sm">
                  <div className="flex items-center gap-1.5">
                    <span className="inline-block h-2 w-2 rounded-full bg-blue-500" />
                    <span className="text-gray-600">
                      {c._count.dossiersPrincipaux} principal{c._count.dossiersPrincipaux !== 1 ? "s" : ""}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="inline-block h-2 w-2 rounded-full bg-gray-300" />
                    <span className="text-gray-600">
                      {c._count.dossiersSecondaires} assistant
                    </span>
                  </div>
                </div>

                {/* Actions */}
                <div className="mt-3 flex gap-2 border-t border-gray-100 pt-3 opacity-0 transition-opacity group-hover:opacity-100">
                  {isArchived ? (
                    <>
                      <button
                        onClick={() => handleReactivate(c)}
                        className="rounded-lg px-3 py-1.5 text-xs font-medium text-green-600 hover:bg-green-50"
                      >
                        Réactiver
                      </button>
                      <button
                        onClick={() => setDeleteTarget(c)}
                        className="rounded-lg px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50"
                      >
                        Supprimer
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => openEdit(c)}
                        className="rounded-lg px-3 py-1.5 text-xs font-medium text-blue-600 hover:bg-blue-50"
                      >
                        Modifier
                      </button>
                      <button
                        onClick={() => { setArchiveTarget(c); setArchiveDateFin("") }}
                        className="rounded-lg px-3 py-1.5 text-xs font-medium text-amber-600 hover:bg-amber-50"
                      >
                        Archiver
                      </button>
                      <button
                        onClick={() => setDeleteTarget(c)}
                        className="rounded-lg px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50"
                      >
                        Supprimer
                      </button>
                    </>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Modal créer / modifier */}
      {showModal && (
        <>
          <div className="fixed inset-0 z-40 bg-black/30" onClick={closeModal} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-2xl">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-bold text-gray-900">
                  {editCollab ? "Modifier le collaborateur" : "Ajouter un collaborateur"}
                </h2>
                <button onClick={closeModal} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600">
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-700">Prénom *</label>
                    <input
                      value={form.prenom}
                      onChange={(e) => setForm({ ...form, prenom: e.target.value })}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      placeholder="Prénom"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-700">Nom</label>
                    <input
                      value={form.nom}
                      onChange={(e) => setForm({ ...form, nom: e.target.value })}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      placeholder="Nom"
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-700">Email</label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    placeholder="email@exemple.fr"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-700">Date d&apos;arrivée</label>
                  <input
                    type="date"
                    value={form.dateArrivee}
                    onChange={(e) => setForm({ ...form, dateArrivee: e.target.value })}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-700">Rôle *</label>
                  <div className="grid grid-cols-2 gap-2">
                    {ROLES.map((r) => {
                      const rc = ROLE_CONFIG[r.value]
                      const selected = form.role === r.value
                      return (
                        <button
                          key={r.value}
                          type="button"
                          onClick={() => setForm({ ...form, role: r.value })}
                          className={`rounded-lg border-2 px-3 py-2 text-sm font-medium transition-all ${
                            selected
                              ? `border-blue-500 ${rc.bg} ${rc.text}`
                              : "border-gray-200 text-gray-500 hover:border-gray-300"
                          }`}
                        >
                          {r.label}
                        </button>
                      )
                    })}
                  </div>
                </div>

                {error && <p className="text-sm text-red-600">{error}</p>}

                <div className="flex justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={closeModal}
                    className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                  >
                    {saving ? (editCollab ? "Enregistrement..." : "Création...") : (editCollab ? "Enregistrer" : "Créer")}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </>
      )}

      {/* Modal archiver */}
      {archiveTarget && (
        <>
          <div className="fixed inset-0 z-40 bg-black/30" onClick={() => setArchiveTarget(null)} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-2xl">
              <h2 className="text-lg font-bold text-gray-900">Archiver le collaborateur</h2>
              <p className="mt-2 text-sm text-gray-600">
                <span className="font-semibold">{archiveTarget.prenom} {archiveTarget.nom}</span> sera
                déplacé dans les archives. Ses dossiers resteront assignés.
              </p>

              <div className="mt-4">
                <label className="mb-1 block text-xs font-medium text-gray-700">Date de fin de contrat</label>
                <input
                  type="date"
                  value={archiveDateFin}
                  onChange={(e) => setArchiveDateFin(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div className="mt-5 flex justify-end gap-3">
                <button
                  onClick={() => setArchiveTarget(null)}
                  className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Annuler
                </button>
                <button
                  onClick={handleArchive}
                  disabled={archiving}
                  className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-50"
                >
                  {archiving ? "Archivage..." : "Archiver"}
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Modal supprimer */}
      {deleteTarget && (
        <>
          <div className="fixed inset-0 z-40 bg-black/30" onClick={() => setDeleteTarget(null)} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-2xl">
              <h2 className="text-lg font-bold text-red-700">Supprimer définitivement</h2>
              <p className="mt-2 text-sm text-gray-600">
                Supprimer <span className="font-semibold">{deleteTarget.prenom} {deleteTarget.nom}</span> ?
                Cette action est irréversible. Les dossiers principaux seront détachés.
              </p>
              {(deleteTarget._count.dossiersPrincipaux > 0 || deleteTarget._count.dossiersSecondaires > 0) && (
                <div className="mt-3 rounded-lg bg-red-50 p-3 text-xs text-red-700">
                  Ce collaborateur est assigné à {deleteTarget._count.dossiersPrincipaux + deleteTarget._count.dossiersSecondaires} dossier(s).
                  Les assignations seront supprimées.
                </div>
              )}

              <div className="mt-5 flex justify-end gap-3">
                <button
                  onClick={() => setDeleteTarget(null)}
                  className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Annuler
                </button>
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
                >
                  {deleting ? "Suppression..." : "Supprimer"}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </main>
  )
}
