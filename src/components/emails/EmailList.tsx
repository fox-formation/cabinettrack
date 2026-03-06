"use client"

import { useState } from "react"
import EmailDrawer from "./EmailDrawer"
import { useToast } from "@/components/ui/Toast"

interface EmailItem {
  id: string
  expediteur: string
  sujet: string
  corpsTexte: string | null
  dateReception: string | Date
  resumeIa: string | null
  tagIa: string | null
  confianceMatchIa: string | null
  valide: boolean
  rattacheAuto: boolean
  dossier: { id: string; raisonSociale: string } | null
}

interface DossierOption {
  id: string
  raisonSociale: string
}

interface EmailListProps {
  emails: EmailItem[]
  dossiers: DossierOption[]
}

function tagColor(tag: string | null): string {
  switch (tag) {
    case "FISCAL": return "bg-purple-100 text-purple-700"
    case "SOCIAL": return "bg-teal-100 text-teal-700"
    case "JURIDIQUE": return "bg-indigo-100 text-indigo-700"
    case "ADMIN": return "bg-amber-100 text-amber-700"
    default: return "bg-gray-100 text-gray-600"
  }
}

export default function EmailList({ emails, dossiers }: EmailListProps) {
  const [selectedEmail, setSelectedEmail] = useState<EmailItem | null>(null)
  const [rattachementId, setRattachementId] = useState<string | null>(null)
  const [rattachementDossierId, setRattachementDossierId] = useState("")
  const toast = useToast()

  async function handleRattacher(emailId: string, dossierId: string) {
    if (!dossierId) return

    try {
      const res = await fetch("/api/emails", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emailId, dossierId, valide: true }),
      })
      if (!res.ok) throw new Error("Erreur réseau")
      toast.success("Email rattaché au dossier")
      window.location.reload()
    } catch {
      toast.error("Erreur lors du rattachement")
    }
  }

  return (
    <>
      <div className="divide-y">
        {emails.length === 0 ? (
          <p className="p-8 text-center text-sm text-gray-400">Aucun email trouvé.</p>
        ) : (
          emails.map((email) => (
            <div key={email.id} className="flex items-start gap-4 px-6 py-4 transition-colors hover:bg-gray-50">
              {/* Tag badge */}
              <div className="flex-shrink-0 pt-1">
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${tagColor(email.tagIa)}`}>
                  {email.tagIa ?? "—"}
                </span>
              </div>

              {/* Main content */}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="truncate text-sm font-medium text-gray-900">{email.sujet}</p>
                  {email.rattacheAuto && (
                    <span className="flex-shrink-0 rounded bg-green-100 px-1.5 py-0.5 text-xs text-green-700">
                      Auto
                    </span>
                  )}
                </div>
                <p className="mt-0.5 text-xs text-gray-500">{email.expediteur}</p>
                {email.resumeIa && (
                  <p className="mt-1 line-clamp-2 text-sm text-gray-600">{email.resumeIa}</p>
                )}

                {/* Dossier rattaché */}
                <div className="mt-2 flex items-center gap-2">
                  {email.dossier ? (
                    <a
                      href={`/dossiers/${email.dossier.id}`}
                      className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700 hover:bg-blue-100"
                    >
                      {email.dossier.raisonSociale}
                    </a>
                  ) : (
                    <>
                      {rattachementId === email.id ? (
                        <div className="flex items-center gap-2">
                          <select
                            value={rattachementDossierId}
                            onChange={(e) => setRattachementDossierId(e.target.value)}
                            className="rounded border px-2 py-1 text-xs"
                          >
                            <option value="">Choisir un dossier...</option>
                            {dossiers.map((d) => (
                              <option key={d.id} value={d.id}>{d.raisonSociale}</option>
                            ))}
                          </select>
                          <button
                            onClick={() => handleRattacher(email.id, rattachementDossierId)}
                            className="rounded bg-blue-600 px-2 py-1 text-xs text-white hover:bg-blue-700"
                          >
                            OK
                          </button>
                          <button
                            onClick={() => { setRattachementId(null); setRattachementDossierId("") }}
                            className="text-xs text-gray-400 hover:text-gray-600"
                          >
                            Annuler
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setRattachementId(email.id)}
                          className="rounded-full border border-dashed border-gray-300 px-2 py-0.5 text-xs text-gray-400 hover:border-blue-400 hover:text-blue-600"
                        >
                          + Rattacher à un dossier
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>

              {/* Right side: date + action */}
              <div className="flex flex-shrink-0 flex-col items-end gap-2">
                <span className="text-xs text-gray-400">
                  {new Date(email.dateReception).toLocaleDateString("fr-FR")}
                </span>
                <button
                  onClick={() => setSelectedEmail(email)}
                  className="rounded border px-2 py-1 text-xs text-gray-500 hover:bg-gray-100"
                >
                  Voir
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {selectedEmail && (
        <EmailDrawer email={selectedEmail} onClose={() => setSelectedEmail(null)} />
      )}
    </>
  )
}
