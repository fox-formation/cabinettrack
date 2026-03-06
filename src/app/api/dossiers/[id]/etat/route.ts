import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db/prisma"
import { calculerAvancement, ETAPES_BILAN } from "@/lib/dossiers/avancement"

export const dynamic = "force-dynamic"

// GET /api/dossiers/:id/etat — lightweight endpoint for the panel
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const dossier = await prisma.dossier.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      raisonSociale: true,
      collaborateurPrincipal: { select: { prenom: true } },
      collaborateursSecondaires: {
        include: { user: { select: { prenom: true } } },
        take: 1,
      },
      // All 14 étape fields
      statutCourantSaisie: true,
      statutManquantSaisie: true,
      noteManquantSaisie: true,
      statutRevisionFaite: true,
      statutOdInventaire: true,
      statutManquantRevision: true,
      noteManquantRevision: true,
      statutEtatsFinanciers: true,
      statutLiasseFiscale: true,
      statutSignatureAssocie: true,
      statutEnvoiClient: true,
      statutTeledeclaration: true,
      statut2572: true,
      statutDas2: true,
      statutVerifEnvoi: true,
      statutAgo: true,
      updatedAt: true,
    },
  })

  if (!dossier) {
    return NextResponse.json({ error: "Dossier not found" }, { status: 404 })
  }

  const STATUT_MAP: Record<string, string> = {
    EFFECTUE: "effectue", EN_COURS: "en_cours", DEMI: "demi", QUART: "quart",
  }
  const STATUT_RATIO: Record<string, number> = {
    EFFECTUE: 1, EN_COURS: 0.75, DEMI: 0.5, QUART: 0.25,
  }

  // Compute avancement from the selected fields
  const etapes = ETAPES_BILAN.map((etape) => {
    const val = dossier[etape.cle as keyof typeof dossier] as string | null
    return {
      cle: etape.cle as string,
      label: etape.label,
      poids: etape.poids,
      hasNote: etape.hasNote,
      noteField: etape.noteField as string | undefined,
      statut: val ? (STATUT_MAP[val] ?? "non_demarre") : "non_demarre",
      rawValue: val,
      noteValue: etape.noteField ? (dossier[etape.noteField as keyof typeof dossier] as string | null) : undefined,
    }
  })

  // Calculate avancement manually from steps
  const avancement = ETAPES_BILAN.reduce((total, etape) => {
    if (etape.poids === 0) return total
    const val = dossier[etape.cle as keyof typeof dossier] as string | null
    if (!val) return total
    return total + etape.poids * (STATUT_RATIO[val] ?? 0)
  }, 0)

  return NextResponse.json({
    id: dossier.id,
    raisonSociale: dossier.raisonSociale,
    collaborateur: dossier.collaborateurPrincipal?.prenom ?? null,
    assistant: dossier.collaborateursSecondaires[0]?.user?.prenom ?? null,
    avancement,
    etapes,
    updatedAt: dossier.updatedAt,
  })
}
