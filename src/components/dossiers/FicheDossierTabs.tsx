"use client"

import { useState, useCallback, useEffect } from "react"
import type { Dossier, Echeance, User, CollaborateurDossier, Cabinet, DossierEmail, Groupe } from "@prisma/client"
import GrilleTVA from "./GrilleTVA"
import BarreAvancement from "./BarreAvancement"
import { useToast } from "@/components/ui/Toast"
import OutilCard from "@/components/travaux/OutilCard"
import AgentDossierModal from "@/components/travaux/AgentDossierModal"
import { useSession } from "next-auth/react"

type DossierFull = Dossier & {
  cabinet: Pick<Cabinet, "nom">
  collaborateurPrincipal: Pick<User, "id" | "prenom" | "role"> | null
  collaborateursSecondaires: (CollaborateurDossier & {
    user: Pick<User, "id" | "prenom" | "role">
  })[]
  echeances: Echeance[]
  adressesEmail: DossierEmail[]
  groupe: Pick<Groupe, "id" | "code" | "nom"> | null
}

type CollabOption = Pick<User, "id" | "prenom" | "role">

const TABS = [
  { id: "general", label: "Général" },
  { id: "comptabilite", label: "Comptabilité" },
  { id: "bilan", label: "Bilan & Étapes" },
  { id: "tva", label: "TVA" },
  { id: "is", label: "IS & Impôts" },
  { id: "echeances", label: "Échéances" },
  { id: "travaux", label: "Travaux" },
  { id: "notes", label: "Notes" },
] as const

type TabId = (typeof TABS)[number]["id"]

interface Props {
  dossier: DossierFull
  collaborateurs?: CollabOption[]
}

// Mapping labels pour enums
const formesLabels: Record<string, string> = {
  SAS: "SAS", SCI: "SCI", SARL: "SARL", EURL: "EURL", SASU: "SASU",
  EI: "EI", BNC: "BNC", LMNP: "LMNP", SNC: "SNC", SEP: "SEP", SC: "SC",
  SOCIETE_CIVILE: "Société Civile", ASSOCIATION: "Association", AUTO_ENTREPRENEUR: "Auto-Entrepreneur",
}

const logicielLabels: Record<string, string> = {
  ACD: "ACD", PENNYLANE: "Pennylane", SAGE: "Sage", QUADRA: "Quadra",
  TIIME: "Tiime", AXONAUT: "Axonaut", JULY: "July",
}

const missionLabels: Record<string, string> = {
  SAISIE: "Saisie", SAISIE_MENSUELLE: "Saisie mensuelle", SAISIE_TRIMESTRIELLE: "Saisie trimestrielle",
  SAISIE_SEMESTRIELLE: "Saisie semestrielle", SAISIE_ANNUELLE: "Saisie annuelle", REVISION: "Révision",
}

const ROLE_LABELS: Record<string, string> = {
  ASSISTANT: "Assistant", CONFIRME: "Confirmé", SUPERVISEUR: "Superviseur", EXPERT_COMPTABLE: "Expert-EC",
}

// ──────────────────────────────────────────────
// Hook for PATCH save
// ──────────────────────────────────────────────

function usePatchDossier(dossierId: string) {
  const toast = useToast()
  const [saving, setSaving] = useState(false)

  const patch = useCallback(
    async (data: Record<string, unknown>): Promise<boolean> => {
      setSaving(true)
      try {
        const res = await fetch(`/api/dossiers/${dossierId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        })
        if (!res.ok) throw new Error("Erreur serveur")
        toast.success("Modifications enregistrées")
        return true
      } catch {
        toast.error("Erreur lors de la sauvegarde")
        return false
      } finally {
        setSaving(false)
      }
    },
    [dossierId, toast],
  )

  return { patch, saving }
}

// ──────────────────────────────────────────────
// Main component
// ──────────────────────────────────────────────

export default function FicheDossierTabs({ dossier: initialDossier, collaborateurs = [] }: Props) {
  const [activeTab, setActiveTab] = useState<TabId>("general")
  const [dossier, setDossier] = useState(initialDossier)

  const handleDossierUpdate = useCallback((updates: Partial<DossierFull>) => {
    setDossier((prev) => ({ ...prev, ...updates }))
  }, [])

  return (
    <div>
      {/* Tab navigation */}
      <div className="border-b">
        <nav className="flex gap-1">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-3 text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? "border-b-2 border-blue-600 text-blue-600"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab content */}
      <div className="p-6">
        {activeTab === "general" && (
          <TabGeneral dossier={dossier} collaborateurs={collaborateurs} onUpdate={handleDossierUpdate} />
        )}
        {activeTab === "comptabilite" && (
          <TabComptabilite dossier={dossier} onUpdate={handleDossierUpdate} />
        )}
        {activeTab === "bilan" && <TabBilan dossier={dossier} />}
        {activeTab === "tva" && (
          <TabTVA dossier={dossier} onUpdate={handleDossierUpdate} />
        )}
        {activeTab === "is" && (
          <TabIS dossier={dossier} onUpdate={handleDossierUpdate} />
        )}
        {activeTab === "echeances" && <TabEcheances echeances={dossier.echeances} />}
        {activeTab === "travaux" && <TabTravaux dossier={dossier} />}
        {activeTab === "notes" && <TabNotes dossier={dossier} />}
      </div>
    </div>
  )
}

// ──────────────────────────────────────────────
// Tab Général (Editable)
// ──────────────────────────────────────────────

function TabGeneral({
  dossier,
  collaborateurs,
  onUpdate,
}: {
  dossier: DossierFull
  collaborateurs: CollabOption[]
  onUpdate: (u: Partial<DossierFull>) => void
}) {
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState(getGeneralFormData(dossier))
  const [errors, setErrors] = useState<Record<string, string>>({})
  const { patch, saving } = usePatchDossier(dossier.id)

  function getGeneralFormData(d: DossierFull) {
    return {
      raisonSociale: d.raisonSociale ?? "",
      siren: d.siren ?? "",
      formeJuridique: d.formeJuridique ?? "",
      activite: d.activite ?? "",
      regimeFiscal: d.regimeFiscal ?? "",
      typeMission: d.typeMission ?? "",
      dateClotureExercice: d.dateClotureExercice ? toInputDate(d.dateClotureExercice) : "",
      logicielComptable: d.logicielComptable ?? "",
      nomContact: d.nomContact ?? "",
      emailContact: d.emailContact ?? "",
      telephoneContact: d.telephoneContact ?? "",
      collaborateurPrincipalId: d.collaborateurPrincipalId ?? "",
      groupeId: d.groupeId ?? "",
      commentaireInterne: d.commentaireInterne ?? "",
    }
  }

  function startEdit() {
    setForm(getGeneralFormData(dossier))
    setErrors({})
    setEditing(true)
  }

  function cancel() {
    setEditing(false)
    setErrors({})
  }

  function validate(): boolean {
    const errs: Record<string, string> = {}
    if (!form.raisonSociale.trim()) errs.raisonSociale = "Requis"
    if (form.siren && !/^\d{9}$/.test(form.siren.trim())) errs.siren = "9 chiffres"
    if (form.emailContact && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.emailContact.trim())) errs.emailContact = "Email invalide"
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  async function save() {
    if (!validate()) return

    const data: Record<string, unknown> = {
      raisonSociale: form.raisonSociale.trim(),
      siren: form.siren.trim() || null,
      formeJuridique: form.formeJuridique || null,
      activite: form.activite.trim() || null,
      regimeFiscal: form.regimeFiscal || null,
      typeMission: form.typeMission || null,
      dateClotureExercice: form.dateClotureExercice || null,
      logicielComptable: form.logicielComptable || null,
      nomContact: form.nomContact.trim() || null,
      emailContact: form.emailContact.trim() || null,
      telephoneContact: form.telephoneContact.trim() || null,
      collaborateurPrincipalId: form.collaborateurPrincipalId || null,
      groupeId: form.groupeId || null,
      commentaireInterne: form.commentaireInterne.trim() || null,
    }

    // Optimistic update
    const collab = collaborateurs.find((c) => c.id === form.collaborateurPrincipalId) ?? null
    onUpdate({
      ...data,
      collaborateurPrincipal: collab ? { id: collab.id, prenom: collab.prenom, role: collab.role } : null,
    } as Partial<DossierFull>)

    const ok = await patch(data)
    if (ok) {
      setEditing(false)
    }
  }

  function set(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }))
    if (errors[field]) setErrors((prev) => { const n = { ...prev }; delete n[field]; return n })
  }

  if (!editing) {
    return (
      <div>
        <div className="mb-4 flex justify-end">
          <button onClick={startEdit} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
            Modifier
          </button>
        </div>
        <div className="grid gap-8 md:grid-cols-2">
          <div className="space-y-4">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Identité</h3>
            <InfoRow label="Raison sociale" value={dossier.raisonSociale} />
            <InfoRow label="Cabinet" value={dossier.cabinet.nom} />
            <InfoRow label="Forme juridique" value={dossier.formeJuridique ? formesLabels[dossier.formeJuridique] ?? dossier.formeJuridique : null} />
            <InfoRow label="Régime fiscal" value={dossier.regimeFiscal} />
            <InfoRow label="SIREN" value={dossier.siren} mono />
            <InfoRow label="Activité" value={dossier.activite} />
            <InfoRow label="Mission" value={dossier.typeMission ? missionLabels[dossier.typeMission] ?? dossier.typeMission : null} />
            <InfoRow label="Logiciel" value={dossier.logicielComptable ? logicielLabels[dossier.logicielComptable] ?? dossier.logicielComptable : null} />
            <InfoRow label="Groupe" value={dossier.groupe ? `${dossier.groupe.nom} (${dossier.groupe.code})` : null} />
          </div>
          <div className="space-y-4">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Contact</h3>
            <InfoRow label="Nom" value={dossier.nomContact} />
            <InfoRow label="Email" value={dossier.emailContact} />
            <InfoRow label="Téléphone" value={dossier.telephoneContact} />
            <h3 className="mt-6 text-sm font-semibold uppercase tracking-wide text-gray-500">Collaborateurs</h3>
            <InfoRow
              label="Principal"
              value={dossier.collaborateurPrincipal ? `${dossier.collaborateurPrincipal.prenom} (${ROLE_LABELS[dossier.collaborateurPrincipal.role] ?? dossier.collaborateurPrincipal.role})` : null}
            />
            {dossier.collaborateursSecondaires.map((cs) => (
              <InfoRow
                key={cs.id}
                label="Secondaire"
                value={`${cs.user.prenom} (${ROLE_LABELS[cs.user.role] ?? cs.user.role})`}
              />
            ))}
            <h3 className="mt-6 text-sm font-semibold uppercase tracking-wide text-gray-500">Dates</h3>
            <InfoRow label="Clôture exercice" value={formatDate(dossier.dateClotureExercice)} />
            <InfoRow label="Date prévue arrêté" value={formatDate(dossier.datePrevueArreteBilan)} />
            <InfoRow label="Date arrêté effectif" value={formatDate(dossier.dateArreteBilan)} />
          </div>
        </div>
        {dossier.commentaireInterne && (
          <div className="mt-6">
            <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-500">Commentaire interne</h3>
            <div className="whitespace-pre-wrap rounded-md border bg-gray-50 p-3 text-sm text-gray-700">{dossier.commentaireInterne}</div>
          </div>
        )}
        <AdressesEmailSection dossierId={dossier.id} initialEmails={dossier.adressesEmail} />
      </div>
    )
  }

  // Edit mode
  return (
    <div>
      <div className="mb-4 flex justify-end gap-2">
        <button onClick={cancel} disabled={saving} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50">
          Annuler
        </button>
        <button onClick={save} disabled={saving} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
          {saving ? "Enregistrement..." : "Enregistrer"}
        </button>
      </div>
      <div className="grid gap-8 md:grid-cols-2">
        <div className="space-y-4">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Identité</h3>
          <EditField label="Raison sociale" value={form.raisonSociale} onChange={(v) => set("raisonSociale", v)} error={errors.raisonSociale} required />
          <InfoRow label="Cabinet" value={dossier.cabinet.nom} />
          <EditSelect label="Forme juridique" value={form.formeJuridique} onChange={(v) => set("formeJuridique", v)} options={Object.entries(formesLabels).map(([k, v]) => ({ value: k, label: v }))} />
          <EditSelect label="Régime fiscal" value={form.regimeFiscal} onChange={(v) => set("regimeFiscal", v)} options={[{ value: "IS", label: "IS" }, { value: "IR", label: "IR" }]} />
          <EditField label="SIREN" value={form.siren} onChange={(v) => set("siren", v)} error={errors.siren} mono placeholder="9 chiffres" />
          <EditField label="Activité" value={form.activite} onChange={(v) => set("activite", v)} />
          <EditSelect label="Mission" value={form.typeMission} onChange={(v) => set("typeMission", v)} options={Object.entries(missionLabels).map(([k, v]) => ({ value: k, label: v }))} />
          <EditSelect label="Logiciel" value={form.logicielComptable} onChange={(v) => set("logicielComptable", v)} options={Object.entries(logicielLabels).map(([k, v]) => ({ value: k, label: v }))} />
          <GroupeSelect value={form.groupeId} onChange={(v) => set("groupeId", v)} />
        </div>
        <div className="space-y-4">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Contact</h3>
          <EditField label="Nom" value={form.nomContact} onChange={(v) => set("nomContact", v)} />
          <EditField label="Email" value={form.emailContact} onChange={(v) => set("emailContact", v)} error={errors.emailContact} type="email" />
          <EditField label="Téléphone" value={form.telephoneContact} onChange={(v) => set("telephoneContact", v)} type="tel" />
          <h3 className="mt-6 text-sm font-semibold uppercase tracking-wide text-gray-500">Collaborateurs</h3>
          <EditSelect
            label="Principal"
            value={form.collaborateurPrincipalId}
            onChange={(v) => set("collaborateurPrincipalId", v)}
            options={collaborateurs.map((c) => ({ value: c.id, label: `${c.prenom} (${ROLE_LABELS[c.role] ?? c.role})` }))}
          />
          <h3 className="mt-6 text-sm font-semibold uppercase tracking-wide text-gray-500">Dates</h3>
          <EditField label="Clôture exercice" value={form.dateClotureExercice} onChange={(v) => set("dateClotureExercice", v)} type="date" />
          <InfoRow label="Date prévue arrêté" value={formatDate(dossier.datePrevueArreteBilan)} />
          <InfoRow label="Date arrêté effectif" value={formatDate(dossier.dateArreteBilan)} />
        </div>
      </div>
      <div className="mt-6">
        <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-500">Commentaire interne</h3>
        <textarea
          value={form.commentaireInterne}
          onChange={(e) => set("commentaireInterne", e.target.value)}
          rows={4}
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>
      <AdressesEmailSection dossierId={dossier.id} initialEmails={dossier.adressesEmail} />
    </div>
  )
}

// ──────────────────────────────────────────────
// Adresses email section (standalone CRUD)
// ──────────────────────────────────────────────

interface EmailEntry {
  id: string
  email: string
  label: string | null
}

function AdressesEmailSection({
  dossierId,
  initialEmails,
}: {
  dossierId: string
  initialEmails: DossierEmail[]
}) {
  const toast = useToast()
  const [emails, setEmails] = useState<EmailEntry[]>(
    initialEmails.map((e) => ({ id: e.id, email: e.email, label: e.label }))
  )
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editEmail, setEditEmail] = useState("")
  const [editLabel, setEditLabel] = useState("")
  const [adding, setAdding] = useState(false)
  const [newEmail, setNewEmail] = useState("")
  const [newLabel, setNewLabel] = useState("")
  const [saving, setSaving] = useState(false)

  async function handleAdd() {
    const email = newEmail.trim()
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast.error("Format email invalide")
      return
    }
    setSaving(true)
    try {
      const res = await fetch(`/api/dossiers/${dossierId}/adresses-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, label: newLabel.trim() }),
      })
      if (!res.ok) {
        const err = await res.json()
        toast.error(err.error ?? "Erreur")
        return
      }
      const created = await res.json()
      setEmails((prev) => [...prev, { id: created.id, email: created.email, label: created.label }])
      setNewEmail("")
      setNewLabel("")
      setAdding(false)
      toast.success("Adresse ajoutée")
    } catch {
      toast.error("Erreur réseau")
    } finally {
      setSaving(false)
    }
  }

  async function handleUpdate(id: string) {
    const email = editEmail.trim()
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast.error("Format email invalide")
      return
    }
    setSaving(true)
    try {
      const res = await fetch(`/api/dossiers/${dossierId}/adresses-email/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, label: editLabel.trim() }),
      })
      if (!res.ok) {
        const err = await res.json()
        toast.error(err.error ?? "Erreur")
        return
      }
      setEmails((prev) =>
        prev.map((e) => (e.id === id ? { ...e, email, label: editLabel.trim() || null } : e))
      )
      setEditingId(null)
      toast.success("Adresse modifiée")
    } catch {
      toast.error("Erreur réseau")
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    setSaving(true)
    try {
      const res = await fetch(`/api/dossiers/${dossierId}/adresses-email/${id}`, {
        method: "DELETE",
      })
      if (!res.ok) {
        toast.error("Erreur suppression")
        return
      }
      setEmails((prev) => prev.filter((e) => e.id !== id))
      toast.success("Adresse supprimée")
    } catch {
      toast.error("Erreur réseau")
    } finally {
      setSaving(false)
    }
  }

  function startEdit(entry: EmailEntry) {
    setEditingId(entry.id)
    setEditEmail(entry.email)
    setEditLabel(entry.label ?? "")
  }

  const atLimit = emails.length >= 10

  return (
    <div className="mt-6">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
          Adresses email ({emails.length}/10)
        </h3>
        {!adding && !atLimit && (
          <button
            onClick={() => setAdding(true)}
            className="rounded-md bg-blue-50 px-3 py-1 text-xs font-medium text-blue-600 hover:bg-blue-100"
          >
            + Ajouter
          </button>
        )}
        {atLimit && (
          <span className="text-xs text-gray-400">Limite atteinte</span>
        )}
      </div>

      {emails.length === 0 && !adding && (
        <p className="text-sm text-gray-400">Aucune adresse email</p>
      )}

      <div className="space-y-2">
        {emails.map((entry) => {
          if (editingId === entry.id) {
            return (
              <div key={entry.id} className="flex items-center gap-2 rounded-md border border-blue-200 bg-blue-50 p-2">
                <input
                  type="email"
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  className="flex-1 rounded-md border border-gray-300 px-2 py-1 text-sm focus:border-blue-500 focus:outline-none"
                  placeholder="email@example.com"
                />
                <input
                  type="text"
                  value={editLabel}
                  onChange={(e) => setEditLabel(e.target.value)}
                  className="w-36 rounded-md border border-gray-300 px-2 py-1 text-sm focus:border-blue-500 focus:outline-none"
                  placeholder="Label..."
                />
                <button
                  onClick={() => handleUpdate(entry.id)}
                  disabled={saving}
                  className="rounded-md bg-blue-600 px-2 py-1 text-xs text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  OK
                </button>
                <button
                  onClick={() => setEditingId(null)}
                  className="rounded-md px-2 py-1 text-xs text-gray-500 hover:bg-gray-100"
                >
                  Annuler
                </button>
              </div>
            )
          }
          return (
            <div key={entry.id} className="flex items-center gap-3 rounded-md border border-gray-200 bg-white px-3 py-2">
              <span className="flex-1 text-sm text-gray-900">{entry.email}</span>
              {entry.label && (
                <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">{entry.label}</span>
              )}
              <button
                onClick={() => startEdit(entry)}
                className="text-gray-400 hover:text-blue-600"
                title="Modifier"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                </svg>
              </button>
              <button
                onClick={() => handleDelete(entry.id)}
                disabled={saving}
                className="text-gray-400 hover:text-red-600 disabled:opacity-50"
                title="Supprimer"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
          )
        })}

        {/* Add new */}
        {adding && (
          <div className="flex items-center gap-2 rounded-md border border-green-200 bg-green-50 p-2">
            <input
              type="email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              className="flex-1 rounded-md border border-gray-300 px-2 py-1 text-sm focus:border-blue-500 focus:outline-none"
              placeholder="email@example.com"
              autoFocus
            />
            <input
              type="text"
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              className="w-36 rounded-md border border-gray-300 px-2 py-1 text-sm focus:border-blue-500 focus:outline-none"
              placeholder="Ex: Direction..."
            />
            <button
              onClick={handleAdd}
              disabled={saving}
              className="rounded-md bg-green-600 px-2 py-1 text-xs text-white hover:bg-green-700 disabled:opacity-50"
            >
              Ajouter
            </button>
            <button
              onClick={() => { setAdding(false); setNewEmail(""); setNewLabel("") }}
              className="rounded-md px-2 py-1 text-xs text-gray-500 hover:bg-gray-100"
            >
              Annuler
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ──────────────────────────────────────────────
// Tab Comptabilité
// ──────────────────────────────────────────────

function TabComptabilite({
  dossier,
  onUpdate,
}: {
  dossier: DossierFull
  onUpdate: (u: Partial<DossierFull>) => void
}) {
  const { patch, saving } = usePatchDossier(dossier.id)

  async function togglePaie() {
    const newVal = !dossier.paie
    onUpdate({ paie: newVal })
    const ok = await patch({ paie: newVal })
    if (!ok) onUpdate({ paie: !newVal }) // rollback
  }

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold text-gray-900">Comptabilité</h3>

      {/* Paie */}
      <div className="rounded-lg border border-gray-200 bg-white p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium text-gray-900">Gestion de la paie</p>
            <p className="text-sm text-gray-500">
              {dossier.paie
                ? "Ce dossier inclut la saisie et la révision de la paie dans le suivi courant."
                : "La paie est exclue du suivi courant (les tâches paie ne comptent pas dans l'avancement)."}
            </p>
          </div>
          <button
            onClick={togglePaie}
            disabled={saving}
            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
              dossier.paie ? "bg-blue-600" : "bg-gray-200"
            } ${saving ? "opacity-50" : ""}`}
            role="switch"
            aria-checked={dossier.paie}
          >
            <span
              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                dossier.paie ? "translate-x-5" : "translate-x-0"
              }`}
            />
          </button>
        </div>
      </div>
    </div>
  )
}

// ──────────────────────────────────────────────
// Tab Bilan & Étapes
// ──────────────────────────────────────────────

function TabBilan({ dossier }: { dossier: DossierFull }) {
  const now = new Date()
  const dateLimite = dossier.datePrevueArreteBilan ? new Date(dossier.datePrevueArreteBilan) : null
  const joursRestants = dateLimite
    ? Math.floor((dateLimite.getTime() - now.getTime()) / 86400000)
    : null

  const badgeColor =
    joursRestants === null
      ? ""
      : joursRestants < 0
        ? "bg-red-100 text-red-700"
        : joursRestants <= 15
          ? "bg-red-100 text-red-700"
          : joursRestants <= 30
            ? "bg-orange-100 text-orange-700"
            : "bg-green-100 text-green-700"

  const badgeText =
    joursRestants === null
      ? ""
      : joursRestants < 0
        ? `J+${Math.abs(joursRestants)}`
        : `J-${joursRestants}`

  return (
    <div className="max-w-2xl">
      <div className="mb-6 grid grid-cols-2 gap-4">
        <div className="rounded-lg border bg-gray-50 p-4">
          <p className="text-xs font-medium uppercase text-gray-500">Clôture exercice</p>
          <p className="mt-1 text-lg font-semibold text-gray-900">
            {formatDate(dossier.dateClotureExercice) ?? <span className="text-gray-300">-</span>}
          </p>
        </div>
        <div className="rounded-lg border bg-gray-50 p-4">
          <p className="text-xs font-medium uppercase text-gray-500">
            Date limite bilan
            {dossier.dateBilanPersonnalisee && (
              <span className="ml-1" title="Date personnalisée">&#9999;&#65039;</span>
            )}
          </p>
          <div className="mt-1 flex items-center gap-3">
            <p className="text-lg font-semibold text-gray-900">
              {formatDate(dossier.datePrevueArreteBilan) ?? <span className="text-gray-300">-</span>}
            </p>
            {joursRestants !== null && !dossier.dateArreteBilan && (
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${badgeColor}`}>
                {badgeText}
              </span>
            )}
            {dossier.dateArreteBilan && (
              <span className="rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-bold text-green-700">
                Arrêté le {formatDate(dossier.dateArreteBilan)}
              </span>
            )}
          </div>
        </div>
      </div>

      {dossier.commentaireBilan && (
        <div className="mb-6 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          {dossier.commentaireBilan}
        </div>
      )}
      <BarreAvancement dossier={dossier} dossierId={dossier.id} />
    </div>
  )
}

// ──────────────────────────────────────────────
// Tab TVA (Editable)
// ──────────────────────────────────────────────

const REGIME_TVA_OPTIONS = [
  { value: "RM", label: "Réel mensuel (RM)" },
  { value: "RT", label: "Réel trimestriel (RT)" },
  { value: "ST", label: "Simplifié (ST)" },
  { value: "EXONERE", label: "Exonéré" },
]

const DATE_LIMITE_TVA_OPTIONS = [
  { value: "16", label: "16" },
  { value: "19", label: "19" },
  { value: "21", label: "21" },
  { value: "24", label: "24" },
]

const MOIS_COURTS = ["Jan", "Fév", "Mar", "Avr", "Mai", "Jun", "Jul", "Aoû", "Sep", "Oct", "Nov", "Déc"]

const TVA_CYCLE = [null, "x", "client", "-"] as const

function TabTVA({
  dossier,
  onUpdate,
}: {
  dossier: DossierFull
  onUpdate: (u: Partial<DossierFull>) => void
}) {
  const [editing, setEditing] = useState(false)
  const [regimeTva, setRegimeTva] = useState(dossier.regimeTva ?? "")
  const [dateLimiteTva, setDateLimiteTva] = useState(String(dossier.dateLimiteTva ?? "24"))
  const [tvaSuivi, setTvaSuivi] = useState<Record<string, string | null>>(
    (dossier.tvaSuivi as Record<string, string | null>) ?? {}
  )
  const { patch, saving } = usePatchDossier(dossier.id)

  function startEdit() {
    setRegimeTva(dossier.regimeTva ?? "")
    setDateLimiteTva(String(dossier.dateLimiteTva ?? "24"))
    setTvaSuivi((dossier.tvaSuivi as Record<string, string | null>) ?? {})
    setEditing(true)
  }

  function cancel() {
    setEditing(false)
  }

  async function save() {
    const data: Record<string, unknown> = {
      regimeTva: regimeTva || null,
      dateLimiteTva: dateLimiteTva ? parseInt(dateLimiteTva) : null,
      tvaSuivi: Object.keys(tvaSuivi).length > 0 ? tvaSuivi : null,
    }
    onUpdate(data as Partial<DossierFull>)
    const ok = await patch(data)
    if (ok) setEditing(false)
  }

  function cycleTva(moisKey: string) {
    setTvaSuivi((prev) => {
      const current = prev[moisKey] ?? null
      const idx = TVA_CYCLE.indexOf(current as typeof TVA_CYCLE[number])
      const next = TVA_CYCLE[(idx + 1) % TVA_CYCLE.length]
      return { ...prev, [moisKey]: next }
    })
  }

  if (!editing) {
    return (
      <div>
        <div className="mb-4 flex justify-end">
          <button onClick={startEdit} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
            Modifier
          </button>
        </div>
        <GrilleTVA
          tvaSuivi={dossier.tvaSuivi as Record<string, string | null> | null}
          dateLimiteTva={dossier.dateLimiteTva}
          regimeTva={dossier.regimeTva}
        />
      </div>
    )
  }

  // Edit mode
  const limiteJour = parseInt(dateLimiteTva) || 24
  const annee = 2026

  return (
    <div>
      <div className="mb-4 flex justify-end gap-2">
        <button onClick={cancel} disabled={saving} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50">
          Annuler
        </button>
        <button onClick={save} disabled={saving} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
          {saving ? "Enregistrement..." : "Enregistrer"}
        </button>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-600">Régime :</label>
          <select value={regimeTva} onChange={(e) => setRegimeTva(e.target.value)} className="rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none">
            <option value="">-</option>
            {REGIME_TVA_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-600">Date limite :</label>
          <select value={dateLimiteTva} onChange={(e) => setDateLimiteTva(e.target.value)} className="rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none">
            {DATE_LIMITE_TVA_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
      </div>

      {regimeTva && regimeTva !== "EXONERE" ? (
        <>
          <p className="mb-2 text-xs text-gray-500">Cliquez sur une case pour changer le statut (vide → OK → Client → N/A → vide)</p>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  {MOIS_COURTS.map((m) => (
                    <th key={m} className="border border-gray-200 bg-gray-50 px-2 py-2 text-center text-xs font-semibold text-gray-600">
                      {m}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  {MOIS_COURTS.map((_, i) => {
                    const key = String(i + 1).padStart(2, "0")
                    const val = tvaSuivi[key] ?? null
                    const cell = getTvaCellStyle(val, i, limiteJour, annee)
                    return (
                      <td
                        key={key}
                        onClick={() => cycleTva(key)}
                        className={`border border-gray-200 px-2 py-3 text-center text-xs font-bold cursor-pointer select-none hover:opacity-80 ${cell.bg} ${cell.text}`}
                        title={`Cliquez pour changer (${cell.title})`}
                      >
                        {cell.label}
                      </td>
                    )
                  })}
                </tr>
              </tbody>
            </table>
          </div>
          <div className="mt-3 flex flex-wrap gap-4 text-xs text-gray-500">
            <span className="flex items-center gap-1"><span className="inline-block h-3 w-3 rounded bg-green-600" /> Fait (cabinet)</span>
            <span className="flex items-center gap-1"><span className="inline-block h-3 w-3 rounded bg-blue-600" /> Client</span>
            <span className="flex items-center gap-1"><span className="inline-block h-3 w-3 rounded bg-gray-300" /> N/A</span>
            <span className="flex items-center gap-1"><span className="inline-block h-3 w-3 rounded border border-gray-200 bg-white" /> À faire</span>
          </div>
        </>
      ) : regimeTva === "EXONERE" ? (
        <div className="rounded-md border border-gray-200 bg-gray-50 p-4 text-center text-sm text-gray-500">Exonéré de TVA</div>
      ) : (
        <div className="rounded-md border border-gray-200 bg-gray-50 p-4 text-center text-sm text-gray-500">Sélectionnez un régime TVA</div>
      )}
    </div>
  )
}

function getTvaCellStyle(
  valeur: string | null,
  moisIndex: number,
  dateLimiteTva: number,
  annee: number,
): { bg: string; text: string; label: string; title: string } {
  if (valeur === "x" || valeur === "X") {
    return { bg: "bg-green-600", text: "text-white", label: "OK", title: "Fait (cabinet)" }
  }
  if (valeur === "client" || valeur === "FAIT PAR CLIENT") {
    return { bg: "bg-blue-600", text: "text-white", label: "CLT", title: "Fait par client" }
  }
  if (valeur === "-") {
    return { bg: "bg-gray-300", text: "text-gray-600", label: "-", title: "Non applicable" }
  }
  const now = new Date()
  const dateEcheance = new Date(annee, moisIndex + 1, dateLimiteTva)
  const diff = dateEcheance.getTime() - now.getTime()
  const joursRestants = Math.ceil(diff / 86400000)
  if (joursRestants < 0) {
    return { bg: "bg-red-600", text: "text-white", label: "!", title: `En retard (J+${-joursRestants})` }
  }
  if (joursRestants <= 7) {
    return { bg: "bg-yellow-400", text: "text-yellow-900", label: `J-${joursRestants}`, title: `Échéance dans ${joursRestants}j` }
  }
  return { bg: "bg-white border border-gray-200", text: "text-gray-400", label: "", title: "À faire" }
}

// ──────────────────────────────────────────────
// Tab IS & Impôts (Editable)
// ──────────────────────────────────────────────

const ACOMPTE_IS_OPTIONS = [
  { value: "", label: "À faire" },
  { value: "x", label: "Payé" },
  { value: "-", label: "N/A" },
  { value: "<3000€", label: "<3000€" },
  { value: "Néant", label: "Néant" },
  { value: "Déficit", label: "Déficit" },
  { value: "client", label: "Payé par client" },
]

const CFE_OPTIONS = [
  { value: "", label: "-" },
  { value: "PE", label: "PE" },
  { value: "PH", label: "PH" },
  { value: "PM", label: "PM" },
  { value: "-", label: "N/A" },
]

function TabIS({
  dossier,
  onUpdate,
}: {
  dossier: DossierFull
  onUpdate: (u: Partial<DossierFull>) => void
}) {
  const [editing, setEditing] = useState(false)
  const acomptesInitial = (dossier.acomptesIs as Record<string, string | null>) ?? {}
  const [form, setForm] = useState({
    acompte1: acomptesInitial["1"] ?? "",
    acompte2: acomptesInitial["2"] ?? "",
    acompte3: acomptesInitial["3"] ?? "",
    acompte4: acomptesInitial["4"] ?? "",
    soldeIs: dossier.soldeIs ?? "",
    acompteIsN1: dossier.acompteIsN1 ?? "",
    suiviCfe: dossier.suiviCfe ?? "",
    suiviCvae: dossier.suiviCvae ?? "",
    suiviTvs: dossier.suiviTvs ?? "",
    statut2561: dossier.statut2561 ?? "",
    taxeFonciereNote: dossier.taxeFonciereNote ?? "",
    taxeFonciereDetail: dossier.taxeFonciereDetail ?? "",
    acompteCvae06: dossier.acompteCvae06 ?? "",
    acompteCvae09: dossier.acompteCvae09 ?? "",
    soldeCvae: dossier.soldeCvae ?? "",
  })
  const { patch, saving } = usePatchDossier(dossier.id)

  function startEdit() {
    const ac = (dossier.acomptesIs as Record<string, string | null>) ?? {}
    setForm({
      acompte1: ac["1"] ?? "",
      acompte2: ac["2"] ?? "",
      acompte3: ac["3"] ?? "",
      acompte4: ac["4"] ?? "",
      soldeIs: dossier.soldeIs ?? "",
      acompteIsN1: dossier.acompteIsN1 ?? "",
      suiviCfe: dossier.suiviCfe ?? "",
      suiviCvae: dossier.suiviCvae ?? "",
      suiviTvs: dossier.suiviTvs ?? "",
      statut2561: dossier.statut2561 ?? "",
      taxeFonciereNote: dossier.taxeFonciereNote ?? "",
      taxeFonciereDetail: dossier.taxeFonciereDetail ?? "",
      acompteCvae06: dossier.acompteCvae06 ?? "",
      acompteCvae09: dossier.acompteCvae09 ?? "",
      soldeCvae: dossier.soldeCvae ?? "",
    })
    setEditing(true)
  }

  async function save() {
    const acomptesIs: Record<string, string | null> = {
      "1": form.acompte1 || null,
      "2": form.acompte2 || null,
      "3": form.acompte3 || null,
      "4": form.acompte4 || null,
    }
    const data: Record<string, unknown> = {
      acomptesIs,
      soldeIs: form.soldeIs || null,
      acompteIsN1: form.acompteIsN1 || null,
      suiviCfe: form.suiviCfe || null,
      suiviCvae: form.suiviCvae || null,
      suiviTvs: form.suiviTvs || null,
      statut2561: form.statut2561 || null,
      taxeFonciereNote: form.taxeFonciereNote || null,
      taxeFonciereDetail: form.taxeFonciereDetail || null,
      acompteCvae06: form.acompteCvae06 || null,
      acompteCvae09: form.acompteCvae09 || null,
      soldeCvae: form.soldeCvae || null,
    }
    onUpdate(data as Partial<DossierFull>)
    const ok = await patch(data)
    if (ok) setEditing(false)
  }

  function set(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  if (!editing) {
    return (
      <div>
        <div className="mb-4 flex justify-end">
          <button onClick={startEdit} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
            Modifier
          </button>
        </div>
        <TabISReadOnly dossier={dossier} />
      </div>
    )
  }

  return (
    <div>
      <div className="mb-4 flex justify-end gap-2">
        <button onClick={() => setEditing(false)} disabled={saving} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50">
          Annuler
        </button>
        <button onClick={save} disabled={saving} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
          {saving ? "Enregistrement..." : "Enregistrer"}
        </button>
      </div>

      <div className="space-y-8">
        {/* Acomptes IS */}
        {dossier.regimeFiscal === "IS" && (
          <div>
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">Acomptes IS</h3>
            <div className="grid grid-cols-4 gap-3">
              {(["acompte1", "acompte2", "acompte3", "acompte4"] as const).map((key, i) => (
                <div key={key} className="rounded-md border bg-white p-3">
                  <p className="mb-1 text-xs text-gray-500">Acompte {i + 1}</p>
                  <select value={form[key]} onChange={(e) => set(key, e.target.value)} className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none">
                    {ACOMPTE_IS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
              ))}
            </div>
            <div className="mt-3 grid grid-cols-3 gap-3">
              <EditCardField label="Solde IS" value={form.soldeIs} onChange={(v) => set("soldeIs", v)} />
              <EditCardField label="Acompte IS N+1" value={form.acompteIsN1} onChange={(v) => set("acompteIsN1", v)} />
            </div>
          </div>
        )}

        {/* Taxes diverses */}
        <div>
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">Taxes diverses</h3>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <div className="rounded-md border bg-white p-3">
              <p className="mb-1 text-xs text-gray-500">CFE</p>
              <select value={form.suiviCfe} onChange={(e) => set("suiviCfe", e.target.value)} className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none">
                {CFE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <EditCardField label="CVAE" value={form.suiviCvae} onChange={(v) => set("suiviCvae", v)} />
            <EditCardField label="TVS" value={form.suiviTvs} onChange={(v) => set("suiviTvs", v)} />
            <EditCardField label="2561" value={form.statut2561} onChange={(v) => set("statut2561", v)} />
          </div>
        </div>

        {/* Taxe foncière */}
        <div>
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">Taxe foncière</h3>
          <div className="grid grid-cols-2 gap-3">
            <EditCardField label="TF" value={form.taxeFonciereNote} onChange={(v) => set("taxeFonciereNote", v)} />
            <EditCardField label="Détail" value={form.taxeFonciereDetail} onChange={(v) => set("taxeFonciereDetail", v)} />
          </div>
        </div>

        {/* CVAE détail */}
        <div>
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">CVAE Détail</h3>
          <div className="grid grid-cols-3 gap-3">
            <EditCardField label="Acompte 06" value={form.acompteCvae06} onChange={(v) => set("acompteCvae06", v)} />
            <EditCardField label="Acompte 09" value={form.acompteCvae09} onChange={(v) => set("acompteCvae09", v)} />
            <EditCardField label="Solde" value={form.soldeCvae} onChange={(v) => set("soldeCvae", v)} />
          </div>
        </div>
      </div>
    </div>
  )
}

function TabISReadOnly({ dossier }: { dossier: DossierFull }) {
  const acomptes = (dossier.acomptesIs as Record<string, string | null> | null) ?? {}
  return (
    <div className="space-y-8">
      {dossier.regimeFiscal === "IS" && (
        <div>
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">Acomptes IS</h3>
          <div className="grid grid-cols-4 gap-3">
            {["1", "2", "3", "4"].map((n) => (
              <AcompteCard key={n} label={`Acompte ${n}`} value={acomptes[n] ?? null} />
            ))}
          </div>
          <div className="mt-3 grid grid-cols-3 gap-3">
            <InfoCard label="Solde IS" value={dossier.soldeIs} />
            <InfoCard label="Acompte IS N+1" value={dossier.acompteIsN1} />
          </div>
        </div>
      )}
      <div>
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">Taxes diverses</h3>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <InfoCard label="CFE" value={dossier.suiviCfe} />
          <InfoCard label="CVAE" value={dossier.suiviCvae} />
          <InfoCard label="TVS" value={dossier.suiviTvs} />
          <InfoCard label="2561" value={dossier.statut2561} />
        </div>
      </div>
      {(dossier.taxeFonciereNote || dossier.taxeFonciereDetail) && (
        <div>
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">Taxe foncière</h3>
          <div className="grid grid-cols-2 gap-3">
            <InfoCard label="TF" value={dossier.taxeFonciereNote} />
            <InfoCard label="Détail" value={dossier.taxeFonciereDetail} />
          </div>
        </div>
      )}
      {(dossier.acompteCvae06 || dossier.acompteCvae09 || dossier.soldeCvae) && (
        <div>
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">CVAE Détail</h3>
          <div className="grid grid-cols-3 gap-3">
            <InfoCard label="Acompte 06" value={dossier.acompteCvae06} />
            <InfoCard label="Acompte 09" value={dossier.acompteCvae09} />
            <InfoCard label="Solde" value={dossier.soldeCvae} />
          </div>
        </div>
      )}
    </div>
  )
}

// ──────────────────────────────────────────────
// Tab Échéances
// ──────────────────────────────────────────────

function TabEcheances({ echeances }: { echeances: Echeance[] }) {
  const now = new Date()

  if (echeances.length === 0) {
    return <p className="text-sm text-gray-400">Aucune échéance générée pour ce dossier.</p>
  }

  const sorted = [...echeances].sort(
    (a, b) => new Date(a.dateEcheance).getTime() - new Date(b.dateEcheance).getTime()
  )

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left text-xs font-semibold uppercase text-gray-500">
            <th className="pb-2 pr-4">Date</th>
            <th className="pb-2 pr-4">Libellé</th>
            <th className="pb-2 pr-4">Type</th>
            <th className="pb-2 pr-4">Statut</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {sorted.map((e) => {
            const date = new Date(e.dateEcheance)
            const isPassee = date < now && e.statut === "A_FAIRE"
            const isBientot =
              !isPassee &&
              e.statut === "A_FAIRE" &&
              date.getTime() - now.getTime() < 7 * 86400000

            return (
              <tr key={e.id} className={isPassee ? "bg-red-50" : isBientot ? "bg-yellow-50" : ""}>
                <td className="py-2 pr-4 font-mono text-xs">
                  {date.toLocaleDateString("fr-FR")}
                </td>
                <td className="py-2 pr-4 font-medium text-gray-900">{e.libelle}</td>
                <td className="py-2 pr-4">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      e.type === "FISCALE"
                        ? "bg-purple-100 text-purple-700"
                        : e.type === "JURIDIQUE"
                          ? "bg-indigo-100 text-indigo-700"
                          : "bg-teal-100 text-teal-700"
                    }`}
                  >
                    {e.type}
                  </span>
                </td>
                <td className="py-2 pr-4">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      e.statut === "FAIT"
                        ? "bg-green-100 text-green-700"
                        : e.statut === "EN_COURS"
                          ? "bg-amber-100 text-amber-700"
                          : isPassee
                            ? "bg-red-100 text-red-700"
                            : "bg-gray-100 text-gray-600"
                    }`}
                  >
                    {e.statut === "FAIT"
                      ? "Fait"
                      : e.statut === "EN_COURS"
                        ? "En cours"
                        : isPassee
                          ? "EN RETARD"
                          : "À faire"}
                  </span>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ──────────────────────────────────────────────
// Tab Notes
// ──────────────────────────────────────────────

const CYCLES_NOTES = [
  { key: "GENERAL", label: "Note Générale", icone: "📋" },
  { key: "TRESORERIE", label: "Trésorerie", icone: "🏦" },
  { key: "ACHATS_FOURNISSEURS", label: "Achats et Fournisseurs", icone: "🛒" },
  { key: "CHARGES_EXTERNES", label: "Charges Externes", icone: "💳" },
  { key: "VENTES_CLIENTS", label: "Ventes et Clients", icone: "💰" },
  { key: "STOCK", label: "Stock", icone: "📦" },
  { key: "IMMOBILISATIONS", label: "Immobilisations", icone: "🏗️" },
  { key: "SOCIAL_PAIE", label: "Social et Paie", icone: "👥" },
  { key: "ETAT", label: "État", icone: "🏛️" },
  { key: "CAPITAUX_PROPRES", label: "Capitaux Propres", icone: "📊" },
  { key: "AUTRES", label: "Autres", icone: "📝" },
] as const

type CycleKey = (typeof CYCLES_NOTES)[number]["key"]

function TabNotes({ dossier }: { dossier: DossierFull }) {
  const { patch, saving } = usePatchDossier(dossier.id)
  const existingNotes = (dossier.notesCycles ?? {}) as Record<string, string>
  const [notes, setNotes] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {}
    for (const c of CYCLES_NOTES) init[c.key] = existingNotes[c.key] ?? ""
    return init
  })
  const [expandedCycle, setExpandedCycle] = useState<CycleKey | null>("GENERAL")

  const handleSave = useCallback(async (key: string) => {
    const updated = { ...existingNotes, ...notes }
    // Remove empty notes
    for (const k of Object.keys(updated)) {
      if (!updated[k]?.trim()) delete updated[k]
    }
    await patch({ notesCycles: Object.keys(updated).length > 0 ? updated : null })
  }, [notes, existingNotes, patch])

  const hasContent = (key: string) => !!notes[key]?.trim()

  const handleExportTxt = useCallback(() => {
    const separator = "═".repeat(60)
    const lines: string[] = [
      `NOTES DU DOSSIER — ${dossier.raisonSociale}`,
      `Date d'export : ${new Date().toLocaleDateString("fr-FR")}`,
      separator,
      "",
    ]

    for (const cycle of CYCLES_NOTES) {
      const content = notes[cycle.key]?.trim()
      lines.push(`${cycle.icone} ${cycle.label.toUpperCase()}`)
      lines.push("─".repeat(40))
      lines.push(content || "(aucune note)")
      lines.push("")
      lines.push(separator)
      lines.push("")
    }

    const blob = new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    const safeName = dossier.raisonSociale.replace(/[^a-zA-Z0-9À-ÿ\s-]/g, "").slice(0, 30)
    a.download = `Notes_${safeName}_${new Date().toISOString().slice(0, 10)}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }, [notes, dossier.raisonSociale])

  return (
    <div className="space-y-6">
      {/* Existing comments (read-only) */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <h3 className="mb-2 text-sm font-semibold text-gray-700">Commentaire interne</h3>
          <div className="min-h-[80px] whitespace-pre-wrap rounded-md border bg-white p-4 text-sm text-gray-700">
            {dossier.commentaireInterne || <span className="text-gray-400">Aucun commentaire</span>}
          </div>
        </div>
        <div>
          <h3 className="mb-2 text-sm font-semibold text-gray-700">Commentaire bilan en cours</h3>
          <div className="min-h-[80px] whitespace-pre-wrap rounded-md border bg-white p-4 text-sm text-gray-700">
            {dossier.commentaireBilan || <span className="text-gray-400">Aucun commentaire</span>}
          </div>
        </div>
      </div>

      {/* Cycle-based notes */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-base font-semibold text-gray-900">Notes par cycle comptable</h3>
          <button
            onClick={handleExportTxt}
            className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-50"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Exporter les informations du dossier
          </button>
        </div>
        <div className="space-y-2">
          {CYCLES_NOTES.map((cycle) => {
            const isExpanded = expandedCycle === cycle.key
            const filled = hasContent(cycle.key)
            return (
              <div
                key={cycle.key}
                className={`rounded-lg border transition-colors ${
                  isExpanded ? "border-blue-200 bg-blue-50/30" : filled ? "border-green-200 bg-green-50/20" : "border-gray-200"
                }`}
              >
                <button
                  type="button"
                  onClick={() => setExpandedCycle(isExpanded ? null : cycle.key)}
                  className="flex w-full items-center justify-between px-4 py-3"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-base">{cycle.icone}</span>
                    <span className="text-sm font-medium text-gray-800">{cycle.label}</span>
                    {filled && (
                      <span className="rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-medium text-green-700">
                        renseigné
                      </span>
                    )}
                  </div>
                  <svg
                    className={`h-4 w-4 text-gray-400 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {isExpanded && (
                  <div className="border-t px-4 py-3">
                    <textarea
                      value={notes[cycle.key] ?? ""}
                      onChange={(e) =>
                        setNotes((prev) => ({ ...prev, [cycle.key]: e.target.value }))
                      }
                      placeholder={`Notes pour ${cycle.label}...`}
                      rows={4}
                      className="w-full resize-y rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-700 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                    <div className="mt-2 flex justify-end">
                      <button
                        onClick={() => handleSave(cycle.key)}
                        disabled={saving}
                        className="rounded-lg bg-blue-600 px-4 py-1.5 text-xs font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
                      >
                        {saving ? "Enregistrement..." : "Enregistrer"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ──────────────────────────────────────────────
// Tab Travaux (Outils IA)
// ──────────────────────────────────────────────

function TabTravaux({ dossier }: { dossier: DossierFull }) {
  const [agentModalOpen, setAgentModalOpen] = useState(false)
  const { data: session } = useSession()

  const userNumero = (session?.user as Record<string, unknown> | undefined)?.numero as string ?? "N/A"
  const dateArrete = dossier.dateArreteBilan ?? dossier.dateClotureExercice
  const dateArreteFmt = dateArrete
    ? new Date(dateArrete).toLocaleDateString("fr-FR")
    : null

  const OUTILS = [
    {
      id: "dossier-travail",
      nom: "Agent Dossier de Travail",
      description: "Analyse une balance CSV et génère un Excel structuré par cycle comptable (immobilisations, clients, fournisseurs, trésorerie...)",
      icone: "📊",
    },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h3 className="mb-1 text-base font-semibold text-gray-900">Outils d&apos;analyse IA</h3>
        <p className="mb-4 text-sm text-gray-500">
          Lancez un agent IA avec le contexte du dossier pré-rempli.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {OUTILS.map((outil) => (
          <OutilCard
            key={outil.id}
            nom={outil.nom}
            description={outil.description}
            icone={outil.icone}
            onLancer={() => {
              if (outil.id === "dossier-travail") setAgentModalOpen(true)
            }}
          />
        ))}
      </div>

      <AgentDossierModal
        open={agentModalOpen}
        onClose={() => setAgentModalOpen(false)}
        dossierId={dossier.id}
        nomClient={dossier.raisonSociale}
        dateArrete={dateArreteFmt}
        preparateur={userNumero}
      />
    </div>
  )
}

// ──────────────────────────────────────────────
// Shared small components
// ──────────────────────────────────────────────

function InfoRow({ label, value, mono }: { label: string; value: string | null | undefined; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-gray-100 py-2">
      <span className="text-sm text-gray-500">{label}</span>
      <span className={`text-sm font-medium text-gray-900 ${mono ? "font-mono" : ""}`}>
        {value || <span className="text-gray-300">-</span>}
      </span>
    </div>
  )
}

function EditField({
  label,
  value,
  onChange,
  error,
  type = "text",
  mono,
  placeholder,
  required,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  error?: string
  type?: string
  mono?: boolean
  placeholder?: string
  required?: boolean
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-gray-100 py-2">
      <span className="text-sm text-gray-500">
        {label}
        {required && <span className="text-red-500"> *</span>}
      </span>
      <div className="flex flex-col items-end">
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={`w-48 rounded-md border px-2 py-1 text-sm text-right focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 ${
            mono ? "font-mono" : ""
          } ${error ? "border-red-400" : "border-gray-300"}`}
        />
        {error && <span className="mt-0.5 text-xs text-red-500">{error}</span>}
      </div>
    </div>
  )
}

function EditSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  options: { value: string; label: string }[]
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-gray-100 py-2">
      <span className="text-sm text-gray-500">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-48 rounded-md border border-gray-300 px-2 py-1 text-sm text-right focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
      >
        <option value="">-</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </div>
  )
}

function EditCardField({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (v: string) => void
}) {
  return (
    <div className="rounded-md border bg-white p-3">
      <p className="mb-1 text-xs text-gray-500">{label}</p>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
      />
    </div>
  )
}

function InfoCard({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="rounded-md border bg-white p-3">
      <p className="text-xs text-gray-500">{label}</p>
      <p className="mt-1 text-sm font-semibold text-gray-900">
        {value || <span className="text-gray-300">-</span>}
      </p>
    </div>
  )
}

function AcompteCard({ label, value }: { label: string; value: string | null }) {
  const bg =
    value === "x" || value === "X"
      ? "border-green-200 bg-green-50"
      : value === "-"
        ? "border-gray-200 bg-gray-50"
        : value === "<3000€" || value === "Néant" || value === "Déficit"
          ? "border-blue-200 bg-blue-50"
          : value === "client"
            ? "border-blue-200 bg-blue-50"
            : "border-gray-200 bg-white"

  const displayValue =
    value === "x" || value === "X"
      ? "Payé"
      : value === "-"
        ? "N/A"
        : value ?? "À faire"

  return (
    <div className={`rounded-md border p-3 ${bg}`}>
      <p className="text-xs text-gray-500">{label}</p>
      <p className="mt-1 text-sm font-semibold">{displayValue}</p>
    </div>
  )
}

function formatDate(date: Date | string | null | undefined): string | null {
  if (!date) return null
  return new Date(date).toLocaleDateString("fr-FR")
}

function toInputDate(date: Date | string | null | undefined): string {
  if (!date) return ""
  const d = new Date(date)
  return d.toISOString().split("T")[0]
}

// ──────────────────────────────────────────────
// Groupe select with create-new option
// ──────────────────────────────────────────────

interface GroupeOption { id: string; code: string; nom: string; nbDossiers: number }

function GroupeSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [groupes, setGroupes] = useState<GroupeOption[]>([])
  const [loaded, setLoaded] = useState(false)
  const [creating, setCreating] = useState(false)
  const [newCode, setNewCode] = useState("")
  const [newNom, setNewNom] = useState("")
  const [error, setError] = useState("")

  useEffect(() => {
    fetch("/api/groupes")
      .then((r) => r.json())
      .then((data: { groupes: GroupeOption[] }) => {
        setGroupes(data.groupes)
        setLoaded(true)
      })
      .catch(() => setLoaded(true))
  }, [])

  async function createGroupe() {
    setError("")
    const code = newCode.trim().replace(/\s+/g, "")
    const nom = newNom.trim()

    if (!code || !nom) {
      setError("Code et nom requis")
      return
    }

    if (!/^[a-zA-Z0-9_-]+$/.test(code)) {
      setError("Code: lettres, chiffres, tirets uniquement")
      return
    }

    const res = await fetch("/api/groupes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code, nom }),
    })

    if (!res.ok) {
      const data = await res.json()
      setError(data.error ?? "Erreur")
      return
    }

    const groupe: GroupeOption = { ...(await res.json()), nbDossiers: 0 }
    setGroupes((prev) => [...prev, groupe].sort((a, b) => a.nom.localeCompare(b.nom)))
    onChange(groupe.id)
    setCreating(false)
    setNewCode("")
    setNewNom("")
  }

  if (!loaded) {
    return (
      <div>
        <label className="mb-1 block text-xs font-medium text-gray-500">Groupe</label>
        <div className="text-xs text-gray-400">Chargement...</div>
      </div>
    )
  }

  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-gray-500">Groupe</label>
      <div className="flex items-center gap-2">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-800 focus:border-blue-300 focus:outline-none"
        >
          <option value="">— Aucun groupe —</option>
          {groupes.map((g) => (
            <option key={g.id} value={g.id}>
              {g.nom} ({g.code}) — {g.nbDossiers} dossier{g.nbDossiers > 1 ? "s" : ""}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => setCreating((v) => !v)}
          className="rounded-lg border border-gray-200 px-2 py-2 text-xs text-gray-500 hover:bg-gray-50"
          title="Créer un nouveau groupe"
        >
          + Nouveau
        </button>
      </div>
      {creating && (
        <div className="mt-2 space-y-2 rounded border border-gray-200 bg-gray-50 p-3">
          <div className="flex gap-2">
            <div className="flex-1">
              <label className="mb-0.5 block text-[10px] font-medium text-gray-500">Code (alphanum, sans espaces)</label>
              <input
                value={newCode}
                onChange={(e) => setNewCode(e.target.value.replace(/\s/g, ""))}
                placeholder="GRP-GIRARD"
                className="w-full rounded border border-gray-200 px-2 py-1 text-xs focus:border-blue-300 focus:outline-none"
              />
            </div>
            <div className="flex-1">
              <label className="mb-0.5 block text-[10px] font-medium text-gray-500">Nom du groupe</label>
              <input
                value={newNom}
                onChange={(e) => setNewNom(e.target.value)}
                placeholder="Groupe Girard"
                className="w-full rounded border border-gray-200 px-2 py-1 text-xs focus:border-blue-300 focus:outline-none"
              />
            </div>
          </div>
          {error && <p className="text-[10px] text-red-500">{error}</p>}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={createGroupe}
              className="rounded bg-blue-600 px-3 py-1 text-xs text-white hover:bg-blue-700"
            >
              Créer
            </button>
            <button
              type="button"
              onClick={() => { setCreating(false); setError("") }}
              className="text-xs text-gray-400 hover:text-gray-600"
            >
              Annuler
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
