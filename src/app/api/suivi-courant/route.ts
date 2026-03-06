import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db/prisma"
import { getTenantId } from "@/lib/tenant"

export const dynamic = "force-dynamic"

const CYCLES = [
  "saisieAchat", "saisieVente", "saisieBanque", "lettrage",
  "paieSaisie", "paieRevision", "tvaDeclaree", "capitauxPropres",
  "lettrageVente", "compteAttenteOk",
] as const

/**
 * GET /api/suivi-courant?periode=2026-03&dossierId=xxx
 * GET /api/suivi-courant?periodes=2026-01,2026-02,2026-03
 * Returns suivi courant for all dossiers of the tenant for given period(s).
 */
export async function GET(req: NextRequest) {
  const tenantId = await getTenantId()
  const { searchParams } = req.nextUrl
  const periode = searchParams.get("periode")
  const periodes = searchParams.get("periodes")
  const dossierId = searchParams.get("dossierId")

  const periodeList = periodes
    ? periodes.split(",").map((p) => p.trim())
    : periode
      ? [periode]
      : null

  if (!periodeList || periodeList.length === 0) {
    return NextResponse.json({ error: "periode or periodes is required" }, { status: 400 })
  }

  const where: Record<string, unknown> = {
    tenantId,
    periode: periodeList.length === 1 ? periodeList[0] : { in: periodeList },
  }
  if (dossierId) where.dossierId = dossierId

  const suivis = await prisma.suiviCourant.findMany({
    where,
    orderBy: { dossier: { raisonSociale: "asc" } },
  })

  // Index by dossierId → periode
  const parDossierPeriode: Record<string, Record<string, typeof suivis[0]>> = {}
  for (const s of suivis) {
    if (!parDossierPeriode[s.dossierId]) parDossierPeriode[s.dossierId] = {}
    parDossierPeriode[s.dossierId][s.periode] = s
  }

  return NextResponse.json({ periodes: periodeList, suivis: parDossierPeriode })
}

const VALID_ETAPE_VALUES = ["EFFECTUE", "EN_COURS", "DEMI", "QUART", null]

/**
 * PATCH /api/suivi-courant
 * Upsert a cycle value for a dossier + periode.
 * Body: { dossierId, periode, field, value }
 *   or: { dossierId, periode, fields: { field1: value1, field2: value2, ... } }  (bulk)
 */
export async function PATCH(req: NextRequest) {
  const tenantId = await getTenantId()
  const body = await req.json()
  const { dossierId, periode } = body

  if (!dossierId || !periode) {
    return NextResponse.json({ error: "dossierId and periode are required" }, { status: 400 })
  }

  const validFields = [...CYCLES, "notePeriode"] as string[]

  // Build update data — supports single field or bulk fields
  const updates: Record<string, string | null> = {}

  if (body.fields && typeof body.fields === "object") {
    // Bulk mode
    for (const [f, v] of Object.entries(body.fields)) {
      if (!validFields.includes(f)) {
        return NextResponse.json({ error: `Invalid field: ${f}` }, { status: 400 })
      }
      if (f !== "notePeriode" && !VALID_ETAPE_VALUES.includes(v as string | null)) {
        return NextResponse.json({ error: `Invalid value for ${f}` }, { status: 400 })
      }
      updates[f] = v as string | null
    }
  } else {
    // Single field mode
    const { field, value } = body
    if (!field) {
      return NextResponse.json({ error: "field is required" }, { status: 400 })
    }
    if (!validFields.includes(field)) {
      return NextResponse.json({ error: `Invalid field: ${field}` }, { status: 400 })
    }
    if (field !== "notePeriode" && !VALID_ETAPE_VALUES.includes(value)) {
      return NextResponse.json({ error: "Value must be EFFECTUE, EN_COURS, DEMI, QUART, or null" }, { status: 400 })
    }
    updates[field] = value
  }

  const suivi = await prisma.suiviCourant.upsert({
    where: {
      tenantId_dossierId_periode: { tenantId, dossierId, periode },
    },
    create: {
      tenantId,
      dossierId,
      periode,
      ...updates,
    },
    update: updates,
  })

  return NextResponse.json(suivi)
}
