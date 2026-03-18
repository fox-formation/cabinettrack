import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db/prisma"
import { getTenantId } from "@/lib/tenant"

export const dynamic = "force-dynamic"

const STATUTS_VALIDES = ["RAS", "ACTION_CABINET", "ACTION_CLIENT", "DEMANDE_CLIENT", "ACTION_REQUISE"] as const

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
  const { dossierId, dateContact, collaborateurId, sens, sujet, resume, statut, prochainContact, dateReponse, reponse } = body

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
    // collaborateurId from frontend is a User ID — resolve to CollaborateurDossier ID
    // Note: DB has duplicate users (collab-* IDs + UUIDs for same person), so we
    // look up by all user IDs sharing the same prenom as fallback.
    let resolvedCollabId: string | null = null
    if (collaborateurId) {
      try {
        // 1. Direct match as CollaborateurDossier ID
        const directMatch = await prisma.collaborateurDossier.findFirst({
          where: { id: collaborateurId },
        })
        if (directMatch) {
          resolvedCollabId = directMatch.id
        } else {
          // 2. Match by userId + dossierId
          const collabDossier = await prisma.collaborateurDossier.findFirst({
            where: { userId: collaborateurId, dossierId },
          })
          if (collabDossier) {
            resolvedCollabId = collabDossier.id
          } else {
            // 3. Fallback: find all user IDs with the same prenom (handles collab-* / UUID duplicates)
            const user = await prisma.user.findUnique({ where: { id: collaborateurId }, select: { prenom: true } })
            if (user) {
              const sameNameUsers = await prisma.user.findMany({
                where: { prenom: user.prenom, tenantId },
                select: { id: true },
              })
              const allIds = sameNameUsers.map((u) => u.id)
              const altMatch = await prisma.collaborateurDossier.findFirst({
                where: { userId: { in: allIds }, dossierId },
              })
              if (altMatch) {
                resolvedCollabId = altMatch.id
              } else {
                // 4. Create the link as last resort
                const newCollab = await prisma.collaborateurDossier.create({
                  data: { userId: collaborateurId, dossierId, roleOnDossier: "secondaire" },
                })
                resolvedCollabId = newCollab.id
              }
            }
          }
        }
      } catch (collabErr) {
        console.error("Failed to resolve collaborateurId:", collabErr)
        resolvedCollabId = null
      }
    }

    const parsedDate = new Date(dateContact)
    if (isNaN(parsedDate.getTime())) {
      return NextResponse.json({ error: "dateContact invalide" }, { status: 400 })
    }

    const suivi = await prisma.suiviRevision.create({
      data: {
        tenantId,
        dossierId,
        dateContact: parsedDate,
        collaborateurId: resolvedCollabId,
        sens: sens || "SORTANT",
        sujet: sujet || null,
        resume: resume || null,
        statut: statut || "RAS",
        prochainContact: prochainContact ? new Date(prochainContact) : null,
        dateReponse: dateReponse ? new Date(dateReponse) : null,
        reponse: reponse || null,
      },
    })

    return NextResponse.json(suivi, { status: 201 })
  } catch (e) {
    console.error("POST /api/suivi-revision error:", e)
    console.error("POST /api/suivi-revision body:", { dossierId, dateContact, collaborateurId, sens, sujet, statut })
    const msg = e instanceof Error ? e.message : "Erreur lors de la création"
    return NextResponse.json({ error: msg }, { status: 500 })
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
    if (fields.collaborateurId) {
      // Resolve User ID to CollaborateurDossier ID (handles collab-*/UUID duplicates)
      let found = await prisma.collaborateurDossier.findFirst({
        where: { userId: fields.collaborateurId, dossierId: existing.dossierId },
      })
      if (!found) {
        const user = await prisma.user.findUnique({ where: { id: fields.collaborateurId }, select: { prenom: true } })
        if (user) {
          const sameNameUsers = await prisma.user.findMany({
            where: { prenom: user.prenom, tenantId },
            select: { id: true },
          })
          found = await prisma.collaborateurDossier.findFirst({
            where: { userId: { in: sameNameUsers.map((u) => u.id) }, dossierId: existing.dossierId },
          })
        }
      }
      data.collaborateurId = found?.id || null
    } else {
      data.collaborateurId = null
    }
  }
  if (fields.dateContact !== undefined) {
    data.dateContact = new Date(fields.dateContact)
  }
  if (fields.dateReponse !== undefined) {
    data.dateReponse = fields.dateReponse ? new Date(fields.dateReponse) : null
  }
  if (fields.reponse !== undefined) {
    data.reponse = fields.reponse || null
  }

  const suivi = await prisma.suiviRevision.update({
    where: { id },
    data,
  })

  return NextResponse.json(suivi)
}
