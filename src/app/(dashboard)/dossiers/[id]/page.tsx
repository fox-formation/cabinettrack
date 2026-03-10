import { prisma } from "@/lib/db/prisma"
import { notFound } from "next/navigation"
import { calculerAvancement } from "@/lib/dossiers/avancement"
import FicheDossierTabs from "@/components/dossiers/FicheDossierTabs"
import Link from "next/link"

export const dynamic = "force-dynamic"

interface PageProps {
  params: { id: string }
}

export default async function DossierDetailPage({ params }: PageProps) {
  const dossier = await prisma.dossier.findUnique({
    where: { id: params.id },
    include: {
      cabinet: { select: { nom: true } },
      collaborateurPrincipal: { select: { id: true, prenom: true, role: true } },
      collaborateursSecondaires: {
        include: { user: { select: { id: true, prenom: true, role: true } } },
      },
      groupe: { select: { id: true, code: true, nom: true } },
      echeances: { orderBy: { dateEcheance: "asc" } },
      adressesEmail: { orderBy: { ordre: "asc" } },
    },
  })

  // Fetch collaborateurs for edit selects
  const collaborateurs = dossier
    ? await prisma.user.findMany({
        where: { tenantId: dossier.tenantId },
        select: { id: true, prenom: true, role: true },
        orderBy: { prenom: "asc" },
      })
    : []

  if (!dossier) notFound()

  const avancement = calculerAvancement(dossier)

  return (
    <main className="p-8">
      {/* Breadcrumb + titre */}
      <div className="mb-6">
        <div className="mb-2 flex items-center gap-2 text-sm text-gray-500">
          <Link href="/dossiers" className="hover:text-gray-700">Dossiers</Link>
          <span>/</span>
          <span className="text-gray-700">{dossier.raisonSociale}</span>
        </div>
        <div className="flex items-center gap-4">
          <h2 className="text-xl font-bold text-gray-900">{dossier.raisonSociale}</h2>
          <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-600">
            {dossier.cabinet.nom}
          </span>
          {dossier.formeJuridique && (
            <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700">
              {dossier.formeJuridique}
            </span>
          )}
          {dossier.regimeFiscal && (
            <span className="rounded-full bg-purple-50 px-3 py-1 text-xs font-medium text-purple-700">
              {dossier.regimeFiscal}
            </span>
          )}
          <span
            className={`ml-auto rounded-full px-3 py-1 text-xs font-bold ${
              avancement >= 100
                ? "bg-green-100 text-green-700"
                : avancement > 50
                  ? "bg-orange-100 text-orange-700"
                  : "bg-red-100 text-red-700"
            }`}
          >
            {avancement}%
          </span>
        </div>
      </div>

      {/* Tabs */}
      <div className="rounded-xl bg-white shadow-sm">
        <FicheDossierTabs dossier={dossier} collaborateurs={collaborateurs} />
      </div>
    </main>
  )
}
