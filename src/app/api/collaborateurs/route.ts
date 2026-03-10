import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db/prisma"
import { getTenantId } from "@/lib/tenant"

export const dynamic = "force-dynamic"

function generateNumero(prenom: string, nom: string): string {
  const p = (prenom || "").trim().charAt(0).toUpperCase()
  const n = (nom || "").trim().substring(0, 2).toUpperCase()
  return `${p}${n}`
}

// GET /api/collaborateurs
export async function GET() {
  const tenantId = await getTenantId()

  const collaborateurs = await prisma.user.findMany({
    where: { tenantId },
    select: {
      id: true,
      numero: true,
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
    },
    orderBy: [{ statut: "asc" }, { prenom: "asc" }],
  })

  return NextResponse.json(collaborateurs)
}

// POST /api/collaborateurs — Ajouter un collaborateur
export async function POST(req: NextRequest) {
  const tenantId = await getTenantId()
  const body = await req.json()
  const { prenom, nom, email, role, dateArrivee } = body

  if (!prenom || typeof prenom !== "string" || !prenom.trim()) {
    return NextResponse.json({ error: "Le prénom est requis" }, { status: 400 })
  }

  const validRoles = ["ASSISTANT", "CONFIRME", "SUPERVISEUR", "EXPERT_COMPTABLE"]
  if (!role || !validRoles.includes(role)) {
    return NextResponse.json({ error: "Rôle invalide" }, { status: 400 })
  }

  // Vérifier unicité email dans le tenant
  if (email && email.trim()) {
    const existing = await prisma.user.findFirst({
      where: { tenantId, email: email.trim() },
    })
    if (existing) {
      return NextResponse.json({ error: "Un collaborateur avec cet email existe déjà" }, { status: 409 })
    }
  }

  const trimmedPrenom = prenom.trim()
  const trimmedNom = nom?.trim() || ""
  const numero = generateNumero(trimmedPrenom, trimmedNom)

  const user = await prisma.user.create({
    data: {
      tenantId,
      numero,
      prenom: trimmedPrenom,
      nom: trimmedNom,
      email: email?.trim() || null,
      role,
      dateArrivee: dateArrivee ? new Date(dateArrivee) : null,
    },
  })

  return NextResponse.json(user, { status: 201 })
}
