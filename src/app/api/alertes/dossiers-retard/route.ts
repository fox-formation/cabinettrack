import { NextResponse } from "next/server"
import { prisma } from "@/lib/db/prisma"
import { getTenantId } from "@/lib/tenant"

export const dynamic = "force-dynamic"

/**
 * GET /api/alertes/dossiers-retard
 * Returns dossiers where datePrevueArreteBilan is past and dateArreteBilan is null.
 */
export async function GET() {
  try {
    const tenantId = await getTenantId()
    const now = new Date()

    const dossiers = await prisma.dossier.findMany({
      where: {
        tenantId,
        datePrevueArreteBilan: { lt: now },
        dateArreteBilan: null,
      },
      select: {
        id: true,
        raisonSociale: true,
        datePrevueArreteBilan: true,
        dateClotureExercice: true,
        collaborateurPrincipal: { select: { id: true, prenom: true } },
        cabinet: { select: { nom: true } },
      },
      orderBy: { datePrevueArreteBilan: "asc" },
    })

    return NextResponse.json(dossiers)
  } catch (err) {
    console.error("[alertes/dossiers-retard]", err)
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
  }
}
