import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db/prisma"
import { getTenantId } from "@/lib/tenant"

export const dynamic = "force-dynamic"

/** GET /api/groupes — Liste tous les groupes du tenant */
export async function GET() {
  const tenantId = await getTenantId()

  const groupes = await prisma.groupe.findMany({
    where: { tenantId },
    orderBy: { nom: "asc" },
    include: { _count: { select: { dossiers: true } } },
  })

  return NextResponse.json({
    groupes: groupes.map((g) => ({
      id: g.id,
      code: g.code,
      nom: g.nom,
      nbDossiers: g._count.dossiers,
    })),
  })
}

/** POST /api/groupes — Crée un nouveau groupe */
export async function POST(req: NextRequest) {
  const tenantId = await getTenantId()
  const body = await req.json()

  const code = String(body.code ?? "").trim().replace(/\s+/g, "")
  const nom = String(body.nom ?? "").trim()

  if (!code) {
    return NextResponse.json({ error: "Le code du groupe est requis (alphanumérique, sans espaces)" }, { status: 400 })
  }

  if (!/^[a-zA-Z0-9_-]+$/.test(code)) {
    return NextResponse.json({ error: "Le code ne doit contenir que des lettres, chiffres, tirets et underscores" }, { status: 400 })
  }

  if (!nom) {
    return NextResponse.json({ error: "Le nom du groupe est requis" }, { status: 400 })
  }

  // Check uniqueness
  const existing = await prisma.groupe.findUnique({
    where: { tenantId_code: { tenantId, code } },
  })

  if (existing) {
    return NextResponse.json({ error: `Un groupe avec le code "${code}" existe déjà` }, { status: 409 })
  }

  const groupe = await prisma.groupe.create({
    data: { tenantId, code, nom },
  })

  return NextResponse.json({ id: groupe.id, code: groupe.code, nom: groupe.nom, nbDossiers: 0 }, { status: 201 })
}
