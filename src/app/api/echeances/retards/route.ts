import { NextResponse } from "next/server"
import { prisma } from "@/lib/db/prisma"
import { getTenantId } from "@/lib/tenant"

export const dynamic = "force-dynamic"

// GET /api/echeances/retards — all overdue + upcoming echeances (A_FAIRE or EN_COURS)
export async function GET() {
  try {
    const tenantId = await getTenantId()

    const echeances = await prisma.echeance.findMany({
      where: {
        tenantId,
        statut: { in: ["A_FAIRE", "EN_COURS"] },
      },
      include: {
        dossier: {
          select: {
            id: true,
            raisonSociale: true,
            collaborateurPrincipalId: true,
            collaborateurPrincipal: { select: { id: true, prenom: true } },
            cabinet: { select: { nom: true } },
          },
        },
      },
      orderBy: { dateEcheance: "asc" },
    })

    return NextResponse.json(echeances)
  } catch (err) {
    console.error("[echeances/retards]", err)
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
  }
}
