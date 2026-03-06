import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db/prisma"

export const dynamic = "force-dynamic"

// GET /api/dossiers/:id/adresses-email
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const dossier = await prisma.dossier.findUnique({
    where: { id: params.id },
    select: { tenantId: true },
  })
  if (!dossier) {
    return NextResponse.json({ error: "Dossier not found" }, { status: 404 })
  }

  const adresses = await prisma.dossierEmail.findMany({
    where: { tenantId: dossier.tenantId, dossierId: params.id },
    orderBy: { ordre: "asc" },
  })

  return NextResponse.json(adresses)
}

// POST /api/dossiers/:id/adresses-email
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const dossier = await prisma.dossier.findUnique({
    where: { id: params.id },
    select: { tenantId: true },
  })
  if (!dossier) {
    return NextResponse.json({ error: "Dossier not found" }, { status: 404 })
  }

  const body = await req.json()
  const email = (body.email ?? "").trim()
  const label = (body.label ?? "").trim() || null

  // Validate email format
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Format email invalide" }, { status: 400 })
  }

  // Check max 10
  const count = await prisma.dossierEmail.count({
    where: { tenantId: dossier.tenantId, dossierId: params.id },
  })
  if (count >= 10) {
    return NextResponse.json({ error: "Limite de 10 adresses atteinte" }, { status: 400 })
  }

  // Check duplicate
  const existing = await prisma.dossierEmail.findFirst({
    where: { tenantId: dossier.tenantId, dossierId: params.id, email },
  })
  if (existing) {
    return NextResponse.json({ error: "Cette adresse existe déjà pour ce dossier" }, { status: 400 })
  }

  const created = await prisma.dossierEmail.create({
    data: {
      tenantId: dossier.tenantId,
      dossierId: params.id,
      email,
      label,
      ordre: count,
    },
  })

  return NextResponse.json(created, { status: 201 })
}
