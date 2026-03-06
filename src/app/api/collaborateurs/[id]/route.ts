import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db/prisma"
import { getTenantId } from "@/lib/tenant"

export const dynamic = "force-dynamic"

const VALID_ROLES = new Set(["ASSISTANT", "CONFIRME", "SUPERVISEUR", "EXPERT_COMPTABLE"])
const VALID_STATUTS = new Set(["ACTIF", "ARCHIVE"])

const USER_SELECT = {
  id: true,
  prenom: true,
  nom: true,
  email: true,
  role: true,
  statut: true,
  dateArrivee: true,
  dateFinContrat: true,
  createdAt: true,
  _count: {
    select: {
      dossiersPrincipaux: true,
      dossiersSecondaires: true,
    },
  },
} as const

type Params = { params: Promise<{ id: string }> }

async function findCollab(id: string, tenantId: string) {
  return prisma.user.findFirst({
    where: { id, tenantId },
    select: { id: true },
  })
}

// PATCH /api/collaborateurs/[id] — Modifier un collaborateur
export async function PATCH(req: NextRequest, { params }: Params) {
  const tenantId = await getTenantId()
  const { id } = await params

  const existing = await findCollab(id, tenantId)
  if (!existing) {
    return NextResponse.json({ error: "Collaborateur introuvable" }, { status: 404 })
  }

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Body JSON invalide" }, { status: 400 })
  }

  const data: Record<string, unknown> = {}

  // Prenom
  if ("prenom" in body) {
    const prenom = typeof body.prenom === "string" ? body.prenom.trim() : ""
    if (!prenom) {
      return NextResponse.json({ error: "Le prénom est requis" }, { status: 400 })
    }
    data.prenom = prenom
  }

  // Nom
  if ("nom" in body) {
    data.nom = typeof body.nom === "string" ? body.nom.trim() : ""
  }

  // Email
  if ("email" in body) {
    const email = typeof body.email === "string" ? body.email.trim() : ""
    if (email) {
      const dup = await prisma.user.findFirst({
        where: { tenantId, email, NOT: { id } },
      })
      if (dup) {
        return NextResponse.json({ error: "Un collaborateur avec cet email existe déjà" }, { status: 409 })
      }
      data.email = email
    } else {
      data.email = null
    }
  }

  // Role
  if ("role" in body) {
    if (!body.role || !VALID_ROLES.has(body.role as string)) {
      return NextResponse.json({ error: "Rôle invalide" }, { status: 400 })
    }
    data.role = body.role
  }

  // Statut (ACTIF / ARCHIVE)
  if ("statut" in body) {
    if (!body.statut || !VALID_STATUTS.has(body.statut as string)) {
      return NextResponse.json({ error: "Statut invalide" }, { status: 400 })
    }
    data.statut = body.statut
  }

  // Date d'arrivée
  if ("dateArrivee" in body) {
    data.dateArrivee = body.dateArrivee ? new Date(body.dateArrivee as string) : null
  }

  // Date fin de contrat
  if ("dateFinContrat" in body) {
    data.dateFinContrat = body.dateFinContrat ? new Date(body.dateFinContrat as string) : null
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Aucun champ à modifier" }, { status: 400 })
  }

  const updated = await prisma.user.update({
    where: { id },
    data: data as Parameters<typeof prisma.user.update>[0]["data"],
    select: USER_SELECT,
  })

  return NextResponse.json(updated)
}

// DELETE /api/collaborateurs/[id] — Supprimer définitivement un collaborateur
export async function DELETE(_req: NextRequest, { params }: Params) {
  const tenantId = await getTenantId()
  const { id } = await params

  const existing = await findCollab(id, tenantId)
  if (!existing) {
    return NextResponse.json({ error: "Collaborateur introuvable" }, { status: 404 })
  }

  // Detach from dossiers principaux before deleting
  await prisma.dossier.updateMany({
    where: { collaborateurPrincipalId: id, tenantId },
    data: { collaborateurPrincipalId: null },
  })

  await prisma.user.delete({ where: { id } })

  return NextResponse.json({ ok: true })
}
