/**
 * Script pour générer les échéances 2026 en base pour tous les dossiers du tenant pilote.
 * Usage: npx tsx scripts/generate-echeances.ts
 */

import { PrismaClient } from "@prisma/client"
import { genererToutesEcheances } from "../src/lib/echeances/generator"

const prisma = new PrismaClient()
const ANNEE = 2026

async function main() {
  const tenant = await prisma.tenant.findFirst()
  if (!tenant) {
    console.error("No tenant found. Run import-excel.ts first.")
    process.exit(1)
  }

  console.log(`🏢 Tenant: ${tenant.nom} (${tenant.id})`)

  const dossiers = await prisma.dossier.findMany({
    where: { tenantId: tenant.id },
  })

  console.log(`📁 ${dossiers.length} dossiers`)

  let totalCreated = 0
  let totalSkipped = 0

  for (const dossier of dossiers) {
    const echeances = genererToutesEcheances(dossier, ANNEE)

    for (const ech of echeances) {
      // Éviter les doublons
      const existing = await prisma.echeance.findFirst({
        where: {
          tenantId: tenant.id,
          dossierId: dossier.id,
          libelle: ech.libelle,
        },
      })

      if (existing) {
        totalSkipped++
        continue
      }

      await prisma.echeance.create({
        data: {
          tenantId: tenant.id,
          dossierId: dossier.id,
          libelle: ech.libelle,
          type: ech.type,
          dateEcheance: ech.dateEcheance,
          cleChamp: ech.cleChamp ?? null,
        },
      })
      totalCreated++
    }
  }

  console.log(`\n📊 Résultat:`)
  console.log(`   Créées  : ${totalCreated}`)
  console.log(`   Ignorées: ${totalSkipped}`)
  console.log(`   Total   : ${totalCreated + totalSkipped}`)

  // Quelques stats
  const byType = await prisma.echeance.groupBy({
    by: ["type"],
    where: { tenantId: tenant.id },
    _count: true,
  })
  console.log(`\n📅 Par type:`)
  for (const t of byType) {
    console.log(`   ${t.type}: ${t._count}`)
  }

  // Prochaines échéances
  const prochaines = await prisma.echeance.findMany({
    where: {
      tenantId: tenant.id,
      dateEcheance: { gte: new Date() },
    },
    include: { dossier: { select: { raisonSociale: true } } },
    orderBy: { dateEcheance: "asc" },
    take: 10,
  })

  console.log(`\n📅 10 prochaines échéances:`)
  for (const e of prochaines) {
    const d = new Date(e.dateEcheance).toLocaleDateString("fr-FR")
    console.log(`   ${d} | ${e.type.padEnd(10)} | ${e.dossier.raisonSociale.padEnd(30)} | ${e.libelle}`)
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
