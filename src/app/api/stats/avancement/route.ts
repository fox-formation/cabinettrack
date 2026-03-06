import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db/prisma"
import { calculerAvancement, ETAPES_BILAN } from "@/lib/dossiers/avancement"

export const dynamic = "force-dynamic"

// GET /api/stats/avancement?tenantId=xxx&collaborateur=uuid&assistant=uuid
export async function GET(req: NextRequest) {
  const tenantId = req.nextUrl.searchParams.get("tenantId")
  if (!tenantId) {
    return NextResponse.json({ error: "tenantId is required" }, { status: 400 })
  }

  const collaborateurFilter = req.nextUrl.searchParams.get("collaborateur")
  const assistantFilter = req.nextUrl.searchParams.get("assistant")

  const now = new Date()

  // Build where clause
  const where: Record<string, unknown> = { tenantId }
  if (collaborateurFilter) {
    where.collaborateurPrincipalId = collaborateurFilter
  }
  if (assistantFilter) {
    where.collaborateursSecondaires = {
      some: { userId: assistantFilter },
    }
  }

  const dossiers = await prisma.dossier.findMany({
    where,
    include: {
      collaborateurPrincipal: { select: { id: true, prenom: true, nom: true } },
    },
  })

  // Global
  let termines = 0
  let enCours = 0
  let nonDemarres = 0

  const dossiersAvecAvancement = dossiers.map((d) => {
    const av = calculerAvancement(d)
    if (av >= 100) termines++
    else if (av > 0) enCours++
    else nonDemarres++
    return { ...d, avancement: av }
  })

  const avancementGlobal = dossiers.length > 0
    ? Math.round((termines / dossiers.length) * 100)
    : 0

  // Par collaborateur
  const collabMap = new Map<string, {
    id: string
    prenom: string
    nom: string
    total: number
    termines: number
    enCours: number
    nonDemarres: number
    retards: number
    sumAvancement: number
  }>()

  for (const d of dossiersAvecAvancement) {
    const collab = d.collaborateurPrincipal
    const key = collab?.id ?? "__none__"

    if (!collabMap.has(key)) {
      collabMap.set(key, {
        id: key,
        prenom: collab?.prenom ?? "Non affecté",
        nom: collab?.nom ?? "",
        total: 0,
        termines: 0,
        enCours: 0,
        nonDemarres: 0,
        retards: 0,
        sumAvancement: 0,
      })
    }

    const entry = collabMap.get(key)!
    entry.total++
    entry.sumAvancement += d.avancement

    if (d.avancement >= 100) entry.termines++
    else if (d.avancement > 0) entry.enCours++
    else entry.nonDemarres++

    if (d.datePrevueArreteBilan && new Date(d.datePrevueArreteBilan) < now && d.dateArreteBilan === null) {
      entry.retards++
    }
  }

  const parCollaborateur = Array.from(collabMap.values())
    .map((c) => ({
      ...c,
      avancementMoyen: c.total > 0 ? Math.round(c.sumAvancement / c.total) : 0,
    }))
    .sort((a, b) => b.total - a.total)

  // Par étape (seulement celles avec poids > 0)
  const parEtape = ETAPES_BILAN.filter((e) => e.poids > 0).map((etape) => {
    let effectue = 0
    let etapeEnCours = 0
    let restant = 0

    for (const d of dossiers) {
      const val = d[etape.cle]
      if (val === "EFFECTUE") {
        effectue++
      } else if (val === "EN_COURS") {
        etapeEnCours++
      } else {
        restant++
      }
    }

    return { label: etape.label, cle: etape.cle as string, poids: etape.poids, effectue, enCours: etapeEnCours, restant }
  })

  // Urgences : dossiers non terminés triés par date prévue
  const urgences = dossiersAvecAvancement
    .filter((d) => d.avancement < 100 && d.datePrevueArreteBilan)
    .map((d) => {
      const datePrevue = new Date(d.datePrevueArreteBilan!)
      const diffJours = Math.floor((datePrevue.getTime() - now.getTime()) / 86400000)
      return {
        id: d.id,
        raisonSociale: d.raisonSociale,
        collaborateur: d.collaborateurPrincipal?.prenom ?? "-",
        collaborateurId: d.collaborateurPrincipal?.id ?? null,
        datePrevue: d.datePrevueArreteBilan,
        joursRestants: diffJours,
        avancement: d.avancement,
        etapesRestantes: ETAPES_BILAN.filter((etape) => {
          if (etape.poids === 0) return false
          const val = d[etape.cle]
          return val !== "EFFECTUE"
        }).map((e) => e.label),
      }
    })
    .sort((a, b) => a.joursRestants - b.joursRestants)
    .slice(0, 30)

  return NextResponse.json({
    global: { termines, enCours, nonDemarres, total: dossiers.length, avancementGlobal },
    parCollaborateur,
    parEtape,
    urgences,
  })
}
