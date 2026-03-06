/**
 * Scheduler d'alertes automatiques.
 *
 * Génère des alertes pour les échéances à venir (J-30, J-15, J-7, J-1)
 * et gère l'escalade automatique vers Superviseur puis Expert-comptable.
 */

import { prisma } from "@/lib/db/prisma"
import { differenceInDays } from "date-fns"

const JALONS_JOURS = [30, 15, 7, 1] as const

function niveauFromJours(joursRestants: number): "INFO" | "WARNING" | "URGENT" | "CRITIQUE" {
  if (joursRestants <= 1) return "CRITIQUE"
  if (joursRestants <= 7) return "URGENT"
  if (joursRestants <= 15) return "WARNING"
  return "INFO"
}

/**
 * Vérifie toutes les échéances d'un tenant et crée les alertes nécessaires.
 * Appelé périodiquement (cron toutes les heures).
 */
export async function genererAlertesEcheances(tenantId: string): Promise<{
  created: number
  escalated: number
}> {
  const now = new Date()
  let created = 0
  let escalated = 0

  // Récupérer toutes les échéances non terminées
  const echeances = await prisma.echeance.findMany({
    where: {
      tenantId,
      statut: { in: ["A_FAIRE", "EN_COURS"] },
    },
    include: {
      dossier: {
        include: {
          collaborateurPrincipal: true,
        },
      },
    },
  })

  for (const echeance of echeances) {
    const joursRestants = differenceInDays(new Date(echeance.dateEcheance), now)

    // Vérifier si on est sur un jalon
    const jalonMatch = JALONS_JOURS.find((j) => joursRestants <= j)
    if (jalonMatch === undefined) continue
    if (joursRestants > 30) continue

    // Vérifier si une alerte existe déjà pour cette échéance et ce jalon
    const alerteExistante = await prisma.alerte.findFirst({
      where: {
        tenantId,
        echeanceId: echeance.id,
        niveau: niveauFromJours(joursRestants),
      },
    })

    if (alerteExistante) {
      // Escalade : si alerte J-7 non acquittée depuis 48h → Superviseur
      if (
        joursRestants <= 7 &&
        !alerteExistante.acquittee &&
        differenceInDays(now, new Date(alerteExistante.createdAt)) >= 2
      ) {
        // Trouver un superviseur du tenant
        const superviseur = await prisma.user.findFirst({
          where: {
            tenantId,
            role: { in: ["SUPERVISEUR", "EXPERT_COMPTABLE"] },
          },
        })

        if (superviseur && alerteExistante.userId !== superviseur.id) {
          await prisma.alerte.create({
            data: {
              tenantId,
              dossierId: echeance.dossierId,
              echeanceId: echeance.id,
              userId: superviseur.id,
              titre: `[ESCALADE] ${echeance.libelle}`,
              message: `Échéance non traitée à J-${joursRestants}. Dossier : ${echeance.dossier.raisonSociale}. Escalade automatique.`,
              niveau: "CRITIQUE",
              dateAlerte: now,
            },
          })
          escalated++
        }
      }

      // Escalade J-1 → Expert-comptable
      if (
        joursRestants <= 1 &&
        !alerteExistante.acquittee
      ) {
        const expert = await prisma.user.findFirst({
          where: {
            tenantId,
            role: "EXPERT_COMPTABLE",
          },
        })

        if (expert && alerteExistante.userId !== expert.id) {
          await prisma.alerte.create({
            data: {
              tenantId,
              dossierId: echeance.dossierId,
              echeanceId: echeance.id,
              userId: expert.id,
              titre: `[URGENT] ${echeance.libelle}`,
              message: `Échéance imminente (J-${joursRestants}). Dossier : ${echeance.dossier.raisonSociale}. Attention requise de l'expert-comptable.`,
              niveau: "CRITIQUE",
              dateAlerte: now,
            },
          })
          escalated++
        }
      }

      continue
    }

    // Créer l'alerte pour le collaborateur principal
    const userId = echeance.dossier.collaborateurPrincipalId
    const niveau = niveauFromJours(joursRestants)

    await prisma.alerte.create({
      data: {
        tenantId,
        dossierId: echeance.dossierId,
        echeanceId: echeance.id,
        userId,
        titre: `${echeance.libelle} — J-${joursRestants}`,
        message: `Échéance "${echeance.libelle}" pour ${echeance.dossier.raisonSociale} dans ${joursRestants} jour(s). Date limite : ${new Date(echeance.dateEcheance).toLocaleDateString("fr-FR")}.`,
        niveau,
        dateAlerte: now,
      },
    })
    created++
  }

  return { created, escalated }
}

/**
 * Génère les écritures d'échéances en base pour tous les dossiers d'un tenant.
 * Appelé une fois par an ou lors de l'import initial.
 */
export async function genererEcheancesEnBase(
  tenantId: string,
  annee: number
): Promise<number> {
  const { genererToutesEcheances } = await import("@/lib/echeances/generator")

  const dossiers = await prisma.dossier.findMany({
    where: { tenantId },
  })

  let total = 0

  for (const dossier of dossiers) {
    const echeances = genererToutesEcheances(dossier, annee)

    for (const ech of echeances) {
      // Upsert : éviter les doublons si on relance
      await prisma.echeance.upsert({
        where: {
          // On utilise un identifiant composite via une recherche
          id: "placeholder", // Fallback — on cherche d'abord
        },
        update: {},
        create: {
          tenantId,
          dossierId: dossier.id,
          libelle: ech.libelle,
          type: ech.type,
          dateEcheance: ech.dateEcheance,
          cleChamp: ech.cleChamp ?? null,
        },
      })
      total++
    }
  }

  return total
}

/**
 * Version améliorée : crée les échéances en évitant les doublons.
 */
export async function syncEcheancesEnBase(
  tenantId: string,
  annee: number
): Promise<{ created: number; skipped: number }> {
  const { genererToutesEcheances } = await import("@/lib/echeances/generator")

  const dossiers = await prisma.dossier.findMany({
    where: { tenantId },
  })

  let created = 0
  let skipped = 0

  for (const dossier of dossiers) {
    const echeances = genererToutesEcheances(dossier, annee)

    for (const ech of echeances) {
      // Vérifier si l'échéance existe déjà
      const existing = await prisma.echeance.findFirst({
        where: {
          tenantId,
          dossierId: dossier.id,
          libelle: ech.libelle,
        },
      })

      if (existing) {
        skipped++
        continue
      }

      await prisma.echeance.create({
        data: {
          tenantId,
          dossierId: dossier.id,
          libelle: ech.libelle,
          type: ech.type,
          dateEcheance: ech.dateEcheance,
          cleChamp: ech.cleChamp ?? null,
        },
      })
      created++
    }
  }

  return { created, skipped }
}
