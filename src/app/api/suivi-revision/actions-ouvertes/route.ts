import { NextResponse } from "next/server"
import { prisma } from "@/lib/db/prisma"
import { getTenantId } from "@/lib/tenant"

export const dynamic = "force-dynamic"

/**
 * GET /api/suivi-revision/actions-ouvertes
 * Returns all SuiviRevision entries needing a response (no dateReponse).
 * REPONSE_A_APPORTER = new statut
 * ACTION_CABINET, ACTION_CLIENT, ACTION_REQUISE, DEMANDE_CLIENT = legacy
 */
export async function GET() {
  const tenantId = await getTenantId()

  const actions = await prisma.suiviRevision.findMany({
    where: {
      tenantId,
      statut: { in: ["REPONSE_A_APPORTER", "ACTION_CABINET", "ACTION_CLIENT", "ACTION_REQUISE", "DEMANDE_CLIENT"] },
      dateReponse: null,
    },
    include: {
      dossier: {
        select: {
          id: true,
          raisonSociale: true,
          collaborateurPrincipal: { select: { prenom: true } },
          cabinet: { select: { nom: true } },
        },
      },
      collaborateur: {
        include: { user: { select: { id: true, prenom: true } } },
      },
    },
    orderBy: { dateContact: "asc" },
  })

  return NextResponse.json(actions)
}
