import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db/prisma"

export const dynamic = "force-dynamic"

// PATCH /api/dossiers/:id/adresses-email/:emailId
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string; emailId: string } }
) {
  const record = await prisma.dossierEmail.findUnique({
    where: { id: params.emailId },
  })
  if (!record || record.dossierId !== params.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  const body = await req.json()
  const data: Record<string, unknown> = {}

  if (body.email !== undefined) {
    const email = (body.email as string).trim()
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "Format email invalide" }, { status: 400 })
    }
    // Check duplicate (exclude self)
    const dup = await prisma.dossierEmail.findFirst({
      where: {
        tenantId: record.tenantId,
        dossierId: params.id,
        email,
        NOT: { id: params.emailId },
      },
    })
    if (dup) {
      return NextResponse.json({ error: "Cette adresse existe déjà" }, { status: 400 })
    }
    data.email = email
  }

  if (body.label !== undefined) {
    data.label = (body.label as string).trim() || null
  }

  const updated = await prisma.dossierEmail.update({
    where: { id: params.emailId },
    data,
  })

  return NextResponse.json(updated)
}

// DELETE /api/dossiers/:id/adresses-email/:emailId
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string; emailId: string } }
) {
  const record = await prisma.dossierEmail.findUnique({
    where: { id: params.emailId },
  })
  if (!record || record.dossierId !== params.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  await prisma.dossierEmail.delete({ where: { id: params.emailId } })
  return NextResponse.json({ success: true })
}
