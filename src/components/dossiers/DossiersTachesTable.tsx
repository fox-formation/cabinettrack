"use client"

import Link from "next/link"
import type { DossierRow } from "./DossiersTabs"

const ROLE_LABELS: Record<string, string> = {
  ASSISTANT: "Assistant",
  CONFIRME: "Confirmé",
  SUPERVISEUR: "Superviseur",
  EXPERT_COMPTABLE: "Expert-EC",
}

const ROLE_COLORS: Record<string, string> = {
  ASSISTANT: "bg-gray-100 text-gray-600",
  CONFIRME: "bg-blue-100 text-blue-700",
  SUPERVISEUR: "bg-purple-100 text-purple-700",
  EXPERT_COMPTABLE: "bg-amber-100 text-amber-700",
}

// Tâches ponctuelles liées aux champs existants du dossier
const TACHES = [
  { key: "statut2572", label: "2572" },
  { key: "statutDas2", label: "DAS 2" },
  { key: "statut2561", label: "2561 (IFU)" },
  { key: "suiviCfe", label: "CFE" },
  { key: "suiviCvae", label: "CVAE" },
  { key: "suiviTvs", label: "TVS" },
] as const

interface DossiersTachesTableProps {
  dossiers: DossierRow[]
}

export default function DossiersTachesTable({ dossiers }: DossiersTachesTableProps) {
  return (
    <div className="overflow-hidden rounded-xl bg-white shadow-sm">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 text-left text-xs font-semibold uppercase text-gray-500">
          <tr>
            <th className="px-4 py-3">Dossier</th>
            <th className="px-4 py-3">Collaborateur</th>
            <th className="px-4 py-3">Assistant</th>
            {TACHES.map((t) => (
              <th key={t.key} className="px-3 py-3 text-center">{t.label}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y">
          {dossiers.map((d) => (
            <tr key={d.id} className="transition-colors hover:bg-gray-50">
              <td className="px-4 py-3">
                <Link href={`/dossiers/${d.id}`} className="font-medium text-blue-600 hover:underline">
                  {d.raisonSociale}
                </Link>
              </td>
              <td className="px-4 py-3">
                {d.collaborateurPrincipal ? (
                  <div className="flex items-center gap-2">
                    <span className="text-gray-900">{d.collaborateurPrincipal.prenom}</span>
                    <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${ROLE_COLORS[d.collaborateurPrincipal.role] ?? "bg-gray-100 text-gray-600"}`}>
                      {ROLE_LABELS[d.collaborateurPrincipal.role] ?? d.collaborateurPrincipal.role}
                    </span>
                  </div>
                ) : (
                  <span className="text-gray-400">-</span>
                )}
              </td>
              <td className="px-4 py-3 text-gray-600">
                {d.firstAssistant ? d.firstAssistant.prenom : <span className="text-gray-400">-</span>}
              </td>
              {TACHES.map((t) => {
                // Map étape statuts based on index in etapeStatuts array
                // statut2572 = index 10, statutDas2 = index 11 in ETAPES_BILAN
                const etapeIndex = getEtapeIndex(t.key)
                const val = etapeIndex !== -1 ? d.etapeStatuts[etapeIndex] : null
                return (
                  <td key={t.key} className="px-3 py-3 text-center">
                    <TacheBadge value={val} />
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// Map tache keys to their index in ETAPES_BILAN
// The etapeStatuts array follows the ETAPES_BILAN order from avancement.ts
const ETAPE_KEY_TO_INDEX: Record<string, number> = {
  statutCourantSaisie: 0,
  statutManquantSaisie: 1,
  statutRevisionFaite: 2,
  statutOdInventaire: 3,
  statutManquantRevision: 4,
  statutEtatsFinanciers: 5,
  statutLiasseFiscale: 6,
  statutSignatureAssocie: 7,
  statutEnvoiClient: 8,
  statutTeledeclaration: 9,
  statut2572: 10,
  statutDas2: 11,
  statutVerifEnvoi: 12,
  statutAgo: 13,
}

function getEtapeIndex(key: string): number {
  return ETAPE_KEY_TO_INDEX[key] ?? -1
}

function TacheBadge({ value }: { value: string | null }) {
  if (value === "EFFECTUE") {
    return (
      <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-green-100 text-xs text-green-600">
        &#x2713;
      </span>
    )
  }
  if (value === "EN_COURS") {
    return (
      <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-orange-100 text-xs text-orange-600">
        &#x25CB;
      </span>
    )
  }
  return (
    <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-gray-100 text-xs text-gray-400">
      &mdash;
    </span>
  )
}
