import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db/prisma"
import { getTenantId } from "@/lib/tenant"

export const dynamic = "force-dynamic"

const STATUTS_VALIDES = ["RAS", "DEMANDE_CLIENT", "ACTION_REQUISE"] as const

/**
 * GET /api/suivi-revision?dossierId=xxx
 * GET /api/suivi-revision?dossierIds=id1,id2,id3  (bulk: latest per dossier)
 * Returns suivi revision entries ordered by date_contact desc.
 */
export async function GET(req: NextRequest) {
  const tenantId = await getTenantId()
  const { searchParams } = req.nextUrl
  const dossierId = searchParams.get("dossierId")
  const dossierIds = searchParams.get("dossierIds")

  if (!dossierId && !dossierIds) {
    return NextResponse.json({ error: "dossierId or dossierIds is required" }, { status: 400 })
  }

  // Bulk mode: return latest entry per dossier
  if (dossierIds) {
    const ids = dossierIds.split(",").map((id) => id.trim())
    const suivis = await prisma.suiviRevision.findMany({
      where: { tenantId, dossierId: { in: ids } },
      include: {
        collaborateur: {
          include: { user: { select: { id: true, prenom: true, role: true } } },
        },
      },
      orderBy: { dateContact: "desc" },
    })
    // Group by dossierId, keep all entries
    const parDossier: Record<string, typeof suivis> = {}
    for (const s of suivis) {
      if (!parDossier[s.dossierId]) parDossier[s.dossierId] = []
      parDossier[s.dossierId].push(s)
    }
    return NextResponse.json(parDossier)
  }

  // Single dossier mode (dossierId guaranteed non-null here)
  const suivis = await prisma.suiviRevision.findMany({
    where: { tenantId, dossierId: dossierId! },
    include: {
      collaborateur: {
        include: { user: { select: { id: true, prenom: true, role: true } } },
      },
    },
    orderBy: { dateContact: "desc" },
  })

  return NextResponse.json(suivis)
}

/**
 * POST /api/suivi-revision
 * Create a new contact entry.
 * Body: { dossierId, dateContact, collaborateurId?, resume?, statut?, prochainContact? }
 */
export async function POST(req: NextRequest) {
  const tenantId = await getTenantId()
  const body = await req.json()
  const { dossierId, dateContact, collaborateurId, sens, sujet, resume, statut, prochainContact } = body

  if (!dossierId || !dateContact) {
    return NextResponse.json({ error: "dossierId and dateContact are required" }, { status: 400 })
  }

  if (statut && !STATUTS_VALIDES.includes(statut)) {
    return NextResponse.json({ error: `Invalid statut. Must be one of: ${STATUTS_VALIDES.join(", ")}` }, { status: 400 })
  }

  const SENS_VALIDES = ["SORTANT", "ENTRANT"] as const
  if (sens && !SENS_VALIDES.includes(sens)) {
    return NextResponse.json({ error: `Invalid sens. Must be one of: ${SENS_VALIDES.join(", ")}` }, { status: 400 })
  }

  try {
    const suivi = await prisma.suiviRevision.create({
      data: {
        tenantId,
        dossierId,
        dateContact: new Date(dateContact),
        collaborateurId: collaborateurId || null,
        sens: sens || "SORTANT",
        sujet: sujet || null,
        resume: resume || null,
        statut: statut || "RAS",
        prochainContact: prochainContact ? new Date(prochainContact) : null,
      },
    })

    return NextResponse.json(suivi, { status: 201 })
  } catch (e) {
    console.error("POST /api/suivi-revision error:", e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Erreur lors de la création" },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/suivi-revision
 * Update an existing entry.
 * Body: { id, resume?, statut?, prochainContact?, collaborateurId? }
 */
export async function PATCH(req: NextRequest) {
  const tenantId = await getTenantId()
  const body = await req.json()
  const { id, ...fields } = body

  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 })
  }

  if (fields.statut && !STATUTS_VALIDES.includes(fields.statut)) {
    return NextResponse.json({ error: `Invalid statut. Must be one of: ${STATUTS_VALIDES.join(", ")}` }, { status: 400 })
  }

  // Verify ownership
  const existing = await prisma.suiviRevision.findFirst({
    where: { id, tenantId },
  })
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  const data: Record<string, unknown> = {}
  if (fields.resume !== undefined) data.resume = fields.resume || null
  if (fields.statut !== undefined) data.statut = fields.statut
  if (fields.sens !== undefined) data.sens = fields.sens
  if (fields.sujet !== undefined) data.sujet = fields.sujet || null
  if (fields.prochainContact !== undefined) {
    data.prochainContact = fields.prochainContact ? new Date(fields.prochainContact) : null
  }
  if (fields.collaborateurId !== undefined) {
    data.collaborateurId = fields.collaborateurId || null
  }
  if (fields.dateContact !== undefined) {
    data.dateContact = new Date(fields.dateContact)
  }

  const suivi = await prisma.suiviRevision.update({
    where: { id },
    data,
  })

  return NextResponse.json(suivi)
}
