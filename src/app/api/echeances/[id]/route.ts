import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db/prisma"
import { getTenantId } from "@/lib/tenant"

const VALID_STATUTS = new Set(["A_FAIRE", "EN_COURS", "FAIT", "NON_APPLICABLE"])

// PATCH /api/echeances/:id — update statut
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const tenantId = await getTenantId()
    const body = await req.json()
    const { statut } = body as { statut: string }

    if (!statut || !VALID_STATUTS.has(statut)) {
      return NextResponse.json(
        { error: "Statut invalide. Valeurs acceptées : A_FAIRE, EN_COURS, FAIT, NON_APPLICABLE" },
        { status: 400 }
      )
    }

    // Verify echeance belongs to tenant
    const echeance = await prisma.echeance.findFirst({
      where: { id: params.id, tenantId },
    })

    if (!echeance) {
      return NextResponse.json({ error: "Échéance non trouvée" }, { status: 404 })
    }

    const updated = await prisma.echeance.update({
      where: { id: params.id },
      data: { statut: statut as "A_FAIRE" | "EN_COURS" | "FAIT" | "NON_APPLICABLE" },
    })

    return NextResponse.json(updated)
  } catch (err) {
    console.error("[echeances/PATCH]", err)
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
  }
}
