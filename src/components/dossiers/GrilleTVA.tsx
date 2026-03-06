"use client"

/**
 * Grille TVA colorée — 12 colonnes (Jan→Déc).
 *
 * Couleurs (miroir Excel CLAUDE.md) :
 * - Vert   #16a34a → "x" | "X"         → FAIT (cabinet)
 * - Bleu   #2563eb → "client"           → CLIENT
 * - Gris   #9ca3af → "-"               → N/A
 * - Blanc           → null + future     → À FAIRE
 * - Rouge  #dc2626 → null + passé      → EN RETARD
 * - Jaune  #eab308 → null + < 7 jours  → BIENTÔT DÛ
 */

const MOIS_COURTS = ["Jan", "Fév", "Mar", "Avr", "Mai", "Jun", "Jul", "Aoû", "Sep", "Oct", "Nov", "Déc"]

interface GrilleTVAProps {
  tvaSuivi: Record<string, string | null> | null
  dateLimiteTva: number | null
  regimeTva: string | null
  annee?: number
}

function getStatutCell(
  valeur: string | null,
  moisIndex: number,
  dateLimiteTva: number,
  annee: number,
): { bg: string; text: string; label: string; title: string } {
  // Fait par cabinet
  if (valeur === "x" || valeur === "X") {
    return { bg: "bg-green-600", text: "text-white", label: "OK", title: "Fait (cabinet)" }
  }
  // Fait par client
  if (valeur === "client" || valeur === "FAIT PAR CLIENT") {
    return { bg: "bg-blue-600", text: "text-white", label: "CLT", title: "Fait par client" }
  }
  // Non applicable
  if (valeur === "-") {
    return { bg: "bg-gray-300", text: "text-gray-600", label: "-", title: "Non applicable" }
  }

  // null → vérifier la date d'échéance pour colorer
  const now = new Date()
  // L'échéance TVA du mois M est le jour `dateLimiteTva` du mois M+1
  const dateEcheance = new Date(annee, moisIndex + 1, dateLimiteTva)

  const diff = dateEcheance.getTime() - now.getTime()
  const joursRestants = Math.ceil(diff / 86400000)

  if (joursRestants < 0) {
    // En retard
    return { bg: "bg-red-600", text: "text-white", label: "!", title: `En retard (J+${-joursRestants})` }
  }
  if (joursRestants <= 7) {
    // Bientôt dû
    return { bg: "bg-yellow-400", text: "text-yellow-900", label: `J-${joursRestants}`, title: `Échéance dans ${joursRestants}j` }
  }
  // Futur → à faire
  return { bg: "bg-white border border-gray-200", text: "text-gray-400", label: "", title: "À faire" }
}

export default function GrilleTVA({ tvaSuivi, dateLimiteTva, regimeTva, annee = 2026 }: GrilleTVAProps) {
  if (!regimeTva || regimeTva === "EXONERE") {
    return (
      <div className="rounded-md border border-gray-200 bg-gray-50 p-4 text-center text-sm text-gray-500">
        {regimeTva === "EXONERE" ? "Exonéré de TVA" : "Régime TVA non renseigné"}
      </div>
    )
  }

  const limiteJour = dateLimiteTva ?? 24
  const suivi = tvaSuivi ?? {}

  return (
    <div>
      <div className="mb-3 flex items-center gap-4 text-sm text-gray-600">
        <span>Régime : <strong>{regimeTva}</strong></span>
        <span>Date limite : <strong>{limiteJour} du mois</strong></span>
      </div>

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
                const valeur = suivi[key] ?? null
                const cell = getStatutCell(valeur, i, limiteJour, annee)
                return (
                  <td
                    key={key}
                    title={cell.title}
                    className={`border border-gray-200 px-2 py-3 text-center text-xs font-bold ${cell.bg} ${cell.text} cursor-default`}
                  >
                    {cell.label}
                  </td>
                )
              })}
            </tr>
          </tbody>
        </table>
      </div>

      {/* Légende */}
      <div className="mt-3 flex flex-wrap gap-4 text-xs text-gray-500">
        <span className="flex items-center gap-1">
          <span className="inline-block h-3 w-3 rounded bg-green-600" /> Fait (cabinet)
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-3 w-3 rounded bg-blue-600" /> Client
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-3 w-3 rounded bg-gray-300" /> N/A
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-3 w-3 rounded border border-gray-200 bg-white" /> À faire
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-3 w-3 rounded bg-yellow-400" /> &lt; 7 jours
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-3 w-3 rounded bg-red-600" /> En retard
        </span>
      </div>
    </div>
  )
}
