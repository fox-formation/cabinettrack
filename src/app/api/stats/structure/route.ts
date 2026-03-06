import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db/prisma"

export const dynamic = "force-dynamic"

// GET /api/stats/structure?tenantId=xxx
export async function GET(req: NextRequest) {
  const tenantId = req.nextUrl.searchParams.get("tenantId")
  if (!tenantId) {
    return NextResponse.json({ error: "tenantId is required" }, { status: 400 })
  }

  const [
    parFormeJuridique,
    parRegimeFiscal,
    parRegimeTva,
    parLogiciel,
    dossiers,
  ] = await Promise.all([
    prisma.dossier.groupBy({
      by: ["formeJuridique"],
      where: { tenantId },
      _count: true,
      orderBy: { _count: { formeJuridique: "desc" } },
    }),
    prisma.dossier.groupBy({
      by: ["regimeFiscal"],
      where: { tenantId },
      _count: true,
    }),
    prisma.dossier.groupBy({
      by: ["regimeTva"],
      where: { tenantId },
      _count: true,
      orderBy: { _count: { regimeTva: "desc" } },
    }),
    prisma.dossier.groupBy({
      by: ["logicielComptable"],
      where: { tenantId },
      _count: true,
      orderBy: { _count: { logicielComptable: "desc" } },
    }),
    prisma.dossier.findMany({
      where: { tenantId },
      select: { collaborateurPrincipalId: true },
    }),
  ])

  // Dossiers par collaborateur
  const collabCounts = new Map<string, number>()
  for (const d of dossiers) {
    const key = d.collaborateurPrincipalId ?? "__none__"
    collabCounts.set(key, (collabCounts.get(key) ?? 0) + 1)
  }

  const collabIds = Array.from(collabCounts.keys()).filter((k) => k !== "__none__")
  const collabs = await prisma.user.findMany({
    where: { id: { in: collabIds } },
    select: { id: true, prenom: true, nom: true },
  })

  const parCollaborateur = collabs
    .map((c) => ({
      id: c.id,
      prenom: c.prenom,
      nom: c.nom,
      nbDossiers: collabCounts.get(c.id) ?? 0,
    }))
    .sort((a, b) => b.nbDossiers - a.nbDossiers)

  const nonAffectes = collabCounts.get("__none__") ?? 0
  if (nonAffectes > 0) {
    parCollaborateur.push({ id: "", prenom: "Non affecté", nom: "", nbDossiers: nonAffectes })
  }

  const formeLabels: Record<string, string> = {
    SAS: "SAS", SCI: "SCI", SARL: "SARL", EURL: "EURL", SASU: "SASU",
    EI: "EI", BNC: "BNC", LMNP: "LMNP", SNC: "SNC", SEP: "SEP",
    SC: "SC", SOCIETE_CIVILE: "Société Civile", ASSOCIATION: "Association",
    AUTO_ENTREPRENEUR: "Auto-Entrepreneur",
  }

  const tvaLabels: Record<string, string> = {
    RM: "Réel mensuel", RT: "Réel trimestriel", ST: "Simplifié", EXONERE: "Exonéré",
  }

  return NextResponse.json({
    formeJuridique: parFormeJuridique.map((r) => ({
      forme: r.formeJuridique,
      label: r.formeJuridique ? formeLabels[r.formeJuridique] ?? r.formeJuridique : "Non renseigné",
      count: r._count,
    })),
    regimeFiscal: parRegimeFiscal.map((r) => ({
      regime: r.regimeFiscal,
      label: r.regimeFiscal ?? "Non renseigné",
      count: r._count,
    })),
    regimeTva: parRegimeTva.map((r) => ({
      regime: r.regimeTva,
      label: r.regimeTva ? tvaLabels[r.regimeTva] ?? r.regimeTva : "Non renseigné",
      count: r._count,
    })),
    logicielComptable: parLogiciel.map((r) => ({
      logiciel: r.logicielComptable,
      label: r.logicielComptable ?? "Non renseigné",
      count: r._count,
    })),
    collaborateurs: parCollaborateur,
    totalDossiers: dossiers.length,
  })
}
