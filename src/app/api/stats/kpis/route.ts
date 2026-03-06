import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db/prisma"
import { calculerAvancement } from "@/lib/dossiers/avancement"
import { addDays } from "date-fns"

export const dynamic = "force-dynamic"

// GET /api/stats/kpis?tenantId=xxx
export async function GET(req: NextRequest) {
  const tenantId = req.nextUrl.searchParams.get("tenantId")
  if (!tenantId) {
    return NextResponse.json({ error: "tenantId is required" }, { status: 400 })
  }

  const now = new Date()
  const dans7jours = addDays(now, 7)

  // Toutes les requêtes en parallèle
  const [
    dossiers,
    echeances7j,
    alertesNonAcquittees,
    totalDossiers,
    repartitionTva,
    cabinets,
  ] = await Promise.all([
    // Tous les dossiers pour calculer avancement + retards
    prisma.dossier.findMany({
      where: { tenantId },
      include: {
        collaborateurPrincipal: { select: { prenom: true } },
        cabinet: { select: { nom: true } },
      },
    }),
    // Échéances dans les 7 prochains jours
    prisma.echeance.count({
      where: {
        tenantId,
        statut: "A_FAIRE",
        dateEcheance: { gte: now, lte: dans7jours },
      },
    }),
    // Alertes non acquittées (WARNING+)
    prisma.alerte.count({
      where: {
        tenantId,
        acquittee: false,
        niveau: { in: ["WARNING", "URGENT", "CRITIQUE"] },
      },
    }),
    // Total dossiers
    prisma.dossier.count({ where: { tenantId } }),
    // Répartition TVA
    prisma.dossier.groupBy({
      by: ["regimeTva"],
      where: { tenantId },
      _count: true,
    }),
    // Cabinets
    prisma.cabinet.findMany({
      where: { tenantId },
      include: { _count: { select: { dossiers: true } } },
    }),
  ])

  // Dossiers en retard : date_prevue_arrete_bilan dépassée + bilan non arrêté
  const dossiersEnRetard = dossiers.filter((d) => {
    if (!d.datePrevueArreteBilan) return false
    return new Date(d.datePrevueArreteBilan) < now && d.dateArreteBilan === null
  })

  // Avancement moyen
  const avancements = dossiers.map((d) => calculerAvancement(d))
  const avancementMoyen =
    avancements.length > 0
      ? Math.round(avancements.reduce((a, b) => a + b, 0) / avancements.length)
      : 0

  // Top 5 dossiers les plus en retard (écart date prévue - aujourd'hui, bilan non arrêté)
  const top5Retard = dossiersEnRetard
    .map((d) => ({
      id: d.id,
      raisonSociale: d.raisonSociale,
      cabinet: d.cabinet.nom,
      collaborateur: d.collaborateurPrincipal?.prenom ?? "-",
      datePrevue: d.datePrevueArreteBilan,
      joursRetard: Math.floor(
        (now.getTime() - new Date(d.datePrevueArreteBilan!).getTime()) / 86400000
      ),
      avancement: calculerAvancement(d),
    }))
    .sort((a, b) => b.joursRetard - a.joursRetard)
    .slice(0, 5)

  // Répartition TVA formatée
  const tvaLabels: Record<string, string> = {
    RM: "Réel mensuel",
    RT: "Réel trimestriel",
    ST: "Simplifié",
    EXONERE: "Exonéré",
  }
  const repartitionTvaFormatted = repartitionTva.map((r) => ({
    regime: r.regimeTva,
    label: r.regimeTva ? tvaLabels[r.regimeTva] ?? r.regimeTva : "Non renseigné",
    count: r._count,
  }))

  return NextResponse.json({
    dossiersEnRetard: dossiersEnRetard.length,
    echeances7jours: echeances7j,
    alertesNonAcquittees,
    avancementMoyen,
    totalDossiers,
    top5Retard,
    repartitionTva: repartitionTvaFormatted,
    cabinets: cabinets.map((c) => ({
      id: c.id,
      nom: c.nom,
      nbDossiers: c._count.dossiers,
    })),
  })
}
