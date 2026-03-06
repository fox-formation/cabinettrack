import { NextResponse } from "next/server"
import { prisma } from "@/lib/db/prisma"
import { toCSV } from "@/lib/exports/csv"
import { calculerAvancement } from "@/lib/dossiers/avancement"
import { getTenantId } from "@/lib/tenant"

export const dynamic = "force-dynamic"

// GET /api/exports/dossiers
export async function GET() {
  let tenantId: string
  try {
    tenantId = await getTenantId()
  } catch {
    return NextResponse.json({ error: "Aucun tenant" }, { status: 400 })
  }

  const dossiers = await prisma.dossier.findMany({
    where: { tenantId },
    include: {
      cabinet: { select: { nom: true } },
      collaborateurPrincipal: { select: { prenom: true } },
    },
    orderBy: { raisonSociale: "asc" },
  })

  const headers = [
    "Raison sociale", "Cabinet", "Collaborateur", "Forme juridique",
    "Régime fiscal", "Régime TVA", "SIREN", "Type mission",
    "Logiciel", "Date clôture", "Date prévue arrêté", "Date arrêté bilan",
    "Avancement (%)",
    "Courant saisie", "Manquant saisie", "Révision faite", "OD inventaire",
    "Manquant révision", "États financiers", "Liasse fiscale",
    "Signature associé", "Envoi client", "Télédéclaration",
    "2572", "DAS 2", "Vérif envoi", "AGO",
  ]

  const rows = dossiers.map((d) => [
    d.raisonSociale,
    d.cabinet.nom,
    d.collaborateurPrincipal?.prenom ?? "",
    d.formeJuridique,
    d.regimeFiscal,
    d.regimeTva,
    d.siren,
    d.typeMission,
    d.logicielComptable,
    d.dateClotureExercice ? new Date(d.dateClotureExercice).toLocaleDateString("fr-FR") : "",
    d.datePrevueArreteBilan ? new Date(d.datePrevueArreteBilan).toLocaleDateString("fr-FR") : "",
    d.dateArreteBilan ? new Date(d.dateArreteBilan).toLocaleDateString("fr-FR") : "",
    calculerAvancement(d),
    d.statutCourantSaisie,
    d.statutManquantSaisie,
    d.statutRevisionFaite,
    d.statutOdInventaire,
    d.statutManquantRevision,
    d.statutEtatsFinanciers,
    d.statutLiasseFiscale,
    d.statutSignatureAssocie,
    d.statutEnvoiClient,
    d.statutTeledeclaration,
    d.statut2572,
    d.statutDas2,
    d.statutVerifEnvoi,
    d.statutAgo,
  ])

  const csv = "\uFEFF" + toCSV(headers, rows) // BOM for Excel

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="dossiers_${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  })
}
