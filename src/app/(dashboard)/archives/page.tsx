import { prisma } from "@/lib/db/prisma"
import { getTenantId } from "@/lib/tenant"
import ArchivesClient from "./ArchivesClient"

export const dynamic = "force-dynamic"

export default async function ArchivesPage({
  searchParams,
}: {
  searchParams: { raison?: string }
}) {
  const tenantId = await getTenantId()

  const where: Record<string, unknown> = { tenantId, statut: "ARCHIVE" }
  if (searchParams.raison) {
    where.raisonArchivage = searchParams.raison
  }

  const dossiers = await prisma.dossier.findMany({
    where,
    select: {
      id: true,
      raisonSociale: true,
      raisonArchivage: true,
      dateArchivage: true,
      collaborateurPrincipal: { select: { prenom: true } },
      cabinet: { select: { nom: true } },
    },
    orderBy: { dateArchivage: "desc" },
  })

  // Raisons uniques pour le filtre
  const raisonsUniques = await prisma.dossier.findMany({
    where: { tenantId, statut: "ARCHIVE", raisonArchivage: { not: null } },
    select: { raisonArchivage: true },
    distinct: ["raisonArchivage"],
  })

  const raisons = raisonsUniques
    .map((r) => r.raisonArchivage)
    .filter((r): r is string => r !== null)
    .sort()

  const serialized = dossiers.map((d) => ({
    id: d.id,
    raisonSociale: d.raisonSociale,
    collaborateur: d.collaborateurPrincipal?.prenom ?? null,
    cabinet: d.cabinet.nom,
    raisonArchivage: d.raisonArchivage,
    dateArchivage: d.dateArchivage?.toISOString() ?? null,
  }))

  return (
    <main className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Archives</h1>
        <p className="mt-1 text-sm text-gray-500">
          {serialized.length} dossier{serialized.length !== 1 ? "s" : ""} archivé{serialized.length !== 1 ? "s" : ""}
        </p>
      </div>

      <ArchivesClient
        dossiers={serialized}
        raisons={raisons}
        filtreRaison={searchParams.raison ?? ""}
      />
    </main>
  )
}
