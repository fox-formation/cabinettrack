import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db/prisma"

export const dynamic = "force-dynamic"

// PATCH /api/alertes/[id] — Acquitter ou marquer lue une alerte
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const body = await req.json()
  const { lue, acquittee } = body

  const alerte = await prisma.alerte.findUnique({
    where: { id: params.id },
  })

  if (!alerte) {
    return NextResponse.json({ error: "Alerte introuvable" }, { status: 404 })
  }

  const data: Record<string, boolean> = {}
  if (typeof lue === "boolean") data.lue = lue
  if (typeof acquittee === "boolean") data.acquittee = acquittee

  const updated = await prisma.alerte.update({
    where: { id: params.id },
    data,
  })

  return NextResponse.json(updated)
}
