import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db/prisma"
import { addMonths } from "date-fns"

export const dynamic = "force-dynamic"

// GET /api/dossiers?tenantId=xxx&cabinetId=xxx&search=xxx
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const tenantId = searchParams.get("tenantId")

  if (!tenantId) {
    return NextResponse.json({ error: "tenantId is required" }, { status: 400 })
  }

  const cabinetId = searchParams.get("cabinetId")
  const search = searchParams.get("search")
  const page = parseInt(searchParams.get("page") || "1", 10)
  const limit = parseInt(searchParams.get("limit") || "50", 10)

  const where: Record<string, unknown> = { tenantId }
  if (cabinetId) where.cabinetId = cabinetId
  if (search) {
    where.raisonSociale = { contains: search, mode: "insensitive" }
  }

  const [dossiers, total] = await Promise.all([
    prisma.dossier.findMany({
      where,
      include: {
        cabinet: { select: { nom: true } },
        collaborateurPrincipal: { select: { id: true, prenom: true, role: true } },
      },
      orderBy: { raisonSociale: "asc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.dossier.count({ where }),
  ])

  return NextResponse.json({ dossiers, total, page, limit })
}

// POST /api/dossiers — Create a new dossier
export async function POST(req: NextRequest) {
  const body = await req.json()

  if (!body.tenantId || !body.cabinetId || !body.raisonSociale) {
    return NextResponse.json(
      { error: "tenantId, cabinetId, and raisonSociale are required" },
      { status: 400 }
    )
  }

  // Calcul auto date limite bilan si dateClotureExercice fournie et pas de datePrevueArreteBilan
  if (body.dateClotureExercice && !body.datePrevueArreteBilan) {
    const cloture = new Date(body.dateClotureExercice)
    if (!isNaN(cloture.getTime())) {
      body.datePrevueArreteBilan = addMonths(cloture, 4)
    }
  }

  const dossier = await prisma.dossier.create({ data: body })
  return NextResponse.json(dossier, { status: 201 })
}
