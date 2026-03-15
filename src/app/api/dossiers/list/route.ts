import { NextResponse } from "next/server"
import { prisma } from "@/lib/db/prisma"
import { getTenantId } from "@/lib/tenant"
import { calculerAvancement, ETAPES_BILAN } from "@/lib/dossiers/avancement"

export const dynamic = "force-dynamic"

/**
 * GET /api/dossiers/list
 * Returns all active dossiers with avancement, collaborateurs list, and KPIs.
 * Filtering is done client-side for instant reactivity.
 */
export async function GET() {
  const tenantId = await getTenantId()

  const [dossiers, collaborateurs, fecImports] = await Promise.all([
    prisma.dossier.findMany({
      where: { tenantId, statut: "ACTIF" },
      include: {
        cabinet: { select: { nom: true } },
        collaborateurPrincipal: { select: { id: true, prenom: true, role: true } },
        collaborateursSecondaires: {
          include: { user: { select: { id: true, prenom: true, role: true } } },
          take: 1,
        },
      },
      orderBy: { raisonSociale: "asc" },
      take: 500,
    }),
    prisma.user.findMany({
      where: { tenantId, statut: "ACTIF" },
      select: { id: true, prenom: true, role: true },
      orderBy: { prenom: "asc" },
    }),
    // Fetch the most recent FEC per dossier (for CA, résultat, nb écritures)
    prisma.fecImport.findMany({
      where: { tenantId },
      orderBy: { exercice: "desc" },
      select: {
        dossierId: true,
        exercice: true,
        chiffreAffaires: true,
        resultat: true,
        nbLignes: true,
      },
    }),
  ])

  // Build a map: dossierId → most recent FEC data
  const fecByDossier = new Map<string, { exercice: number; chiffreAffaires: number | null; resultat: number | null; nbLignes: number }>()
  for (const fec of fecImports) {
    if (!fecByDossier.has(fec.dossierId)) {
      fecByDossier.set(fec.dossierId, fec)
    }
  }

  const rows = dossiers.map((d) => ({
    id: d.id,
    raisonSociale: d.raisonSociale,
    collaborateurPrincipal: d.collaborateurPrincipal
      ? { id: d.collaborateurPrincipal.id, prenom: d.collaborateurPrincipal.prenom, role: d.collaborateurPrincipal.role }
      : null,
    firstAssistant: d.collaborateursSecondaires[0]?.user
      ? { id: d.collaborateursSecondaires[0].user.id, prenom: d.collaborateursSecondaires[0].user.prenom }
      : null,
    datePrevueArreteBilan: d.datePrevueArreteBilan ? d.datePrevueArreteBilan.toISOString() : null,
    dateArreteBilan: d.dateArreteBilan ? d.dateArreteBilan.toISOString() : null,
    dateClotureExercice: d.dateClotureExercice ? d.dateClotureExercice.toISOString() : null,
    avancement: calculerAvancement(d),
    etapeStatuts: ETAPES_BILAN.map((etape) => d[etape.cle] as string | null),
    typeMission: d.typeMission,
    paie: d.paie,
    commentaireBilan: d.commentaireBilan,
    fec: fecByDossier.get(d.id) ?? null,
  }))

  return NextResponse.json({ dossiers: rows, collaborateurs })
}
