import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db/prisma"

export const dynamic = "force-dynamic"

// GET /api/emails?tenantId=xxx&dossierId=xxx&tag=xxx&valide=true
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const tenantId = searchParams.get("tenantId")

  if (!tenantId) {
    return NextResponse.json({ error: "tenantId is required" }, { status: 400 })
  }

  const dossierId = searchParams.get("dossierId")
  const tag = searchParams.get("tag")
  const valide = searchParams.get("valide")
  const nonRattache = searchParams.get("nonRattache")

  const where: Record<string, unknown> = { tenantId }
  if (dossierId) where.dossierId = dossierId
  if (tag) where.tagIa = tag
  if (valide === "true") where.valide = true
  if (valide === "false") where.valide = false
  if (nonRattache === "true") where.dossierId = null

  const emails = await prisma.email.findMany({
    where,
    include: {
      dossier: { select: { id: true, raisonSociale: true } },
    },
    orderBy: { dateReception: "desc" },
    take: 100,
  })

  return NextResponse.json(emails)
}

// PATCH /api/emails — Rattacher un email à un dossier manuellement
export async function PATCH(req: NextRequest) {
  const body = await req.json()
  const { emailId, dossierId, valide } = body

  if (!emailId) {
    return NextResponse.json({ error: "emailId is required" }, { status: 400 })
  }

  const data: Record<string, unknown> = {}
  if (dossierId !== undefined) data.dossierId = dossierId
  if (typeof valide === "boolean") data.valide = valide

  const email = await prisma.email.update({
    where: { id: emailId },
    data,
    include: {
      dossier: { select: { id: true, raisonSociale: true } },
    },
  })

  return NextResponse.json(email)
}
