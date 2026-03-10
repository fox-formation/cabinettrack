/**
 * Script de setup initial — Crée le Tenant, les Cabinets et l'utilisateur admin.
 *
 * Usage :
 *   npx tsx scripts/setup-tenant.ts
 */
import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

async function main() {
  // 1. Créer le Tenant
  const tenant = await prisma.tenant.upsert({
    where: { id: "cabinet-pilote" },
    update: {},
    create: {
      id: "cabinet-pilote",
      nom: "Cabinet Pilote",
    },
  })
  console.log("[setup] Tenant:", tenant.id, tenant.nom)

  // 2. Créer les Cabinets
  const fiduciaire = await prisma.cabinet.upsert({
    where: { tenantId_nom: { tenantId: tenant.id, nom: "Fiduciaire" } },
    update: {},
    create: { tenantId: tenant.id, nom: "Fiduciaire" },
  })

  const finatec = await prisma.cabinet.upsert({
    where: { tenantId_nom: { tenantId: tenant.id, nom: "Finatec" } },
    update: {},
    create: { tenantId: tenant.id, nom: "Finatec" },
  })
  console.log("[setup] Cabinets:", fiduciaire.nom, finatec.nom)

  // 3. Créer l'utilisateur admin
  const adminEmail = "s.touchene@fiduciaire-villeurbannaise.fr"
  const existingUser = await prisma.user.findFirst({
    where: { email: adminEmail },
  })

  if (existingUser) {
    console.log("[setup] User already exists:", existingUser.email, "role:", existingUser.role)
  } else {
    const user = await prisma.user.create({
      data: {
        tenantId: tenant.id,
        prenom: "Samia",
        nom: "Touchene",
        email: adminEmail,
        role: "EXPERT_COMPTABLE",
      },
    })
    console.log("[setup] User created:", user.email, "role:", user.role)
  }

  // 4. Créer les collaborateurs du cabinet pilote
  const collaborateurs = [
    { prenom: "Souhila", role: "CONFIRME" as const },
    { prenom: "Kadija", role: "CONFIRME" as const },
    { prenom: "Cassandre", role: "CONFIRME" as const },
    { prenom: "Shaïnas", role: "CONFIRME" as const },
    { prenom: "Quentin", role: "ASSISTANT" as const },
    { prenom: "Pierre", role: "ASSISTANT" as const },
    { prenom: "Manal", role: "ASSISTANT" as const },
  ]

  for (const c of collaborateurs) {
    await prisma.user.upsert({
      where: { id: `collab-${c.prenom.toLowerCase()}` },
      update: {},
      create: {
        id: `collab-${c.prenom.toLowerCase()}`,
        tenantId: tenant.id,
        prenom: c.prenom,
        role: c.role,
      },
    })
  }
  console.log("[setup] Collaborateurs:", collaborateurs.length, "created/verified")

  console.log("\n[setup] Done! Reconnecte-toi pour que le JWT prenne le tenantId.")
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
