import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db/prisma"
import { addMonths } from "date-fns"

export const dynamic = "force-dynamic"

// Full include for returning complete dossier after updates
const DOSSIER_INCLUDE = {
  cabinet: { select: { nom: true } },
  collaborateurPrincipal: { select: { id: true, prenom: true, role: true } },
  collaborateursSecondaires: {
    include: { user: { select: { id: true, prenom: true, role: true } } },
  },
  echeances: { orderBy: { dateEcheance: "asc" as const } },
  emails: { orderBy: { dateReception: "desc" as const }, take: 20 },
}

// Enum validation sets — values Prisma accepts
const ENUM_FIELDS: Record<string, Set<string>> = {
  formeJuridique: new Set([
    "SAS", "SCI", "SARL", "EURL", "SASU", "EI", "BNC", "LMNP",
    "SNC", "SEP", "SC", "SOCIETE_CIVILE", "ASSOCIATION", "AUTO_ENTREPRENEUR",
  ]),
  regimeFiscal: new Set(["IS", "IR"]),
  regimeTva: new Set(["RM", "ST", "RT", "EXONERE"]),
  typeMission: new Set([
    "SAISIE", "SAISIE_MENSUELLE", "SAISIE_TRIMESTRIELLE",
    "SAISIE_SEMESTRIELLE", "SAISIE_ANNUELLE", "REVISION",
  ]),
  logicielComptable: new Set(["ACD", "PENNYLANE", "SAGE", "QUADRA", "TIIME", "AXONAUT", "JULY"]),
}

// SuiviEtape fields on Dossier that accept QUART | DEMI | EN_COURS | EFFECTUE | null
const SUIVI_ETAPE_FIELDS = new Set([
  "statutCourantSaisie", "statutManquantSaisie", "statutRevisionFaite",
  "statutOdInventaire", "statutManquantRevision", "statutEtatsFinanciers",
  "statutLiasseFiscale", "statutSignatureAssocie", "statutEnvoiClient",
  "statutTeledeclaration", "statut2572", "statutDas2", "statutVerifEnvoi", "statutAgo",
])
const SUIVI_ETAPE_VALUES = new Set(["EFFECTUE", "EN_COURS", "DEMI", "QUART"])

// Date fields that need to be converted from string to Date
const DATE_FIELDS = new Set([
  "dateClotureExercice", "datePrevueArreteBilan", "dateArreteBilan", "dateArchivage",
])

// GET /api/dossiers/:id
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const dossier = await prisma.dossier.findUnique({
    where: { id: params.id },
    include: {
      ...DOSSIER_INCLUDE,
      adressesEmail: { orderBy: { ordre: "asc" } },
    },
  })

  if (!dossier) {
    return NextResponse.json({ error: "Dossier not found" }, { status: 404 })
  }

  return NextResponse.json(dossier)
}

// PATCH /api/dossiers/:id
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  // Never allow changing tenantId or id
  delete body.tenantId
  delete body.id

  // Build clean data object with validation
  const data: Record<string, unknown> = {}
  const errors: string[] = []

  for (const [key, value] of Object.entries(body)) {
    // Skip undefined
    if (value === undefined) continue

    // Enum fields: validate value or accept null to clear
    if (key in ENUM_FIELDS) {
      if (value === null || value === "") {
        data[key] = null
      } else if (typeof value === "string" && ENUM_FIELDS[key].has(value)) {
        data[key] = value
      } else {
        errors.push(`Invalid value for ${key}: "${value}". Expected one of: ${Array.from(ENUM_FIELDS[key]).join(", ")}`)
      }
      continue
    }

    // SuiviEtape fields: EFFECTUE | EN_COURS | null
    if (SUIVI_ETAPE_FIELDS.has(key)) {
      if (value === null || value === "") {
        data[key] = null
      } else if (typeof value === "string" && SUIVI_ETAPE_VALUES.has(value)) {
        data[key] = value
      } else {
        errors.push(`Invalid value for ${key}: "${value}". Expected EFFECTUE, EN_COURS, or null`)
      }
      continue
    }

    // Date fields: convert ISO string → Date, or null to clear
    if (DATE_FIELDS.has(key)) {
      if (value === null || value === "") {
        data[key] = null
      } else if (typeof value === "string") {
        const d = new Date(value)
        if (isNaN(d.getTime())) {
          errors.push(`Invalid date for ${key}: "${value}"`)
        } else {
          data[key] = d
        }
      } else if (value instanceof Date) {
        data[key] = value
      } else {
        errors.push(`Invalid date for ${key}`)
      }
      continue
    }

    // All other fields: pass through as-is
    data[key] = value
  }

  if (errors.length > 0) {
    return NextResponse.json({ error: "Validation failed", details: errors }, { status: 400 })
  }

  // Si datePrevueArreteBilan est modifiée manuellement, marquer comme personnalisée
  if (data.datePrevueArreteBilan !== undefined) {
    data.dateBilanPersonnalisee = true
  }

  // Si dateClotureExercice est modifiée, recalculer datePrevueArreteBilan
  // sauf si l'utilisateur a personnalisé la date
  if (data.dateClotureExercice !== undefined && data.dateClotureExercice !== null) {
    const existing = await prisma.dossier.findUnique({
      where: { id: params.id },
      select: { dateBilanPersonnalisee: true },
    })

    if (existing && !existing.dateBilanPersonnalisee && !data.datePrevueArreteBilan) {
      data.datePrevueArreteBilan = addMonths(data.dateClotureExercice as Date, 4)
    }
  }

  try {
    const dossier = await prisma.dossier.update({
      where: { id: params.id },
      data,
      include: DOSSIER_INCLUDE,
    })

    return NextResponse.json(dossier)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error"
    console.error(`[PATCH /api/dossiers/${params.id}]`, message)

    if (message.includes("Record to update not found")) {
      return NextResponse.json({ error: "Dossier not found" }, { status: 404 })
    }

    return NextResponse.json(
      { error: "Database update failed", details: message },
      { status: 500 },
    )
  }
}

// DELETE /api/dossiers/:id
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  await prisma.dossier.delete({ where: { id: params.id } })
  return NextResponse.json({ success: true })
}
