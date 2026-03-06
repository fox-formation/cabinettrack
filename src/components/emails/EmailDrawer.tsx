"use client"

interface EmailDrawerProps {
  email: {
    id: string
    expediteur: string
    sujet: string
    corpsTexte: string | null
    dateReception: string | Date
    resumeIa: string | null
    tagIa: string | null
    confianceMatchIa: string | null
    dossier: { id: string; raisonSociale: string } | null
  }
  onClose: () => void
}

export default function EmailDrawer({ email, onClose }: EmailDrawerProps) {
  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Overlay */}
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />

      {/* Drawer */}
      <div className="relative z-10 flex w-full max-w-xl flex-col bg-white shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b px-6 py-4">
          <h2 className="text-lg font-semibold text-gray-900">Détail email</h2>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="space-y-4">
            <div>
              <p className="text-xs font-medium uppercase text-gray-500">Expéditeur</p>
              <p className="mt-1 text-sm text-gray-900">{email.expediteur}</p>
            </div>

            <div>
              <p className="text-xs font-medium uppercase text-gray-500">Sujet</p>
              <p className="mt-1 text-sm font-medium text-gray-900">{email.sujet}</p>
            </div>

            <div>
              <p className="text-xs font-medium uppercase text-gray-500">Date</p>
              <p className="mt-1 text-sm text-gray-600">
                {new Date(email.dateReception).toLocaleString("fr-FR")}
              </p>
            </div>

            {email.tagIa && (
              <div>
                <p className="text-xs font-medium uppercase text-gray-500">Classification IA</p>
                <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-xs font-medium ${tagColor(email.tagIa)}`}>
                  {email.tagIa}
                </span>
                {email.confianceMatchIa && (
                  <span className="ml-2 text-xs text-gray-400">
                    Confiance : {email.confianceMatchIa}
                  </span>
                )}
              </div>
            )}

            {email.dossier && (
              <div>
                <p className="text-xs font-medium uppercase text-gray-500">Dossier rattaché</p>
                <a
                  href={`/dossiers/${email.dossier.id}`}
                  className="mt-1 inline-block text-sm font-medium text-blue-600 hover:underline"
                >
                  {email.dossier.raisonSociale}
                </a>
              </div>
            )}

            {email.resumeIa && (
              <div>
                <p className="text-xs font-medium uppercase text-gray-500">Résumé IA</p>
                <div className="mt-1 rounded-md border border-blue-100 bg-blue-50 p-3 text-sm text-gray-700">
                  {email.resumeIa}
                </div>
              </div>
            )}

            <div>
              <p className="text-xs font-medium uppercase text-gray-500">Contenu complet</p>
              <div className="mt-1 max-h-96 overflow-y-auto whitespace-pre-wrap rounded-md border bg-gray-50 p-4 text-sm text-gray-700">
                {email.corpsTexte || "(Aucun contenu)"}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function tagColor(tag: string): string {
  switch (tag) {
    case "FISCAL": return "bg-purple-100 text-purple-700"
    case "SOCIAL": return "bg-teal-100 text-teal-700"
    case "JURIDIQUE": return "bg-indigo-100 text-indigo-700"
    case "ADMIN": return "bg-amber-100 text-amber-700"
    default: return "bg-gray-100 text-gray-600"
  }
}
