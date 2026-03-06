import { prisma } from "@/lib/db/prisma"
import { getTenantId } from "@/lib/tenant"
import EmailList from "@/components/emails/EmailList"
import Link from "next/link"

export const dynamic = "force-dynamic"

interface SearchParams {
  tag?: string
  nonRattache?: string
  dossierId?: string
}

export default async function EmailsPage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  let tenantId: string
  try {
    tenantId = await getTenantId()
  } catch {
    return <p className="p-8 text-gray-500">Aucun tenant configuré.</p>
  }

  const { tag, nonRattache, dossierId } = searchParams

  const where: Record<string, unknown> = { tenantId }
  if (tag) where.tagIa = tag
  if (nonRattache === "true") where.dossierId = null
  if (dossierId) where.dossierId = dossierId

  const [emails, dossiers, counts] = await Promise.all([
    prisma.email.findMany({
      where,
      include: {
        dossier: { select: { id: true, raisonSociale: true } },
      },
      orderBy: { dateReception: "desc" },
      take: 100,
    }),
    prisma.dossier.findMany({
      where: { tenantId },
      select: { id: true, raisonSociale: true },
      orderBy: { raisonSociale: "asc" },
    }),
    prisma.email.groupBy({
      by: ["tagIa"],
      where: { tenantId },
      _count: true,
    }),
  ])

  const totalEmails = counts.reduce((s, c) => s + c._count, 0)
  const nonRattacheCount = await prisma.email.count({
    where: { tenantId, dossierId: null },
  })

  return (
    <main className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Emails</h1>
        <p className="text-sm text-gray-500">Suivi des emails entrants</p>
      </div>
        <div className="flex gap-8">
          {/* Sidebar filters */}
          <div className="w-56 flex-shrink-0">
            <div className="rounded-lg border bg-white p-4">
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500">Filtres</h3>

              <div className="space-y-1">
                <FilterLink href="/emails" label="Tous" count={totalEmails} active={!tag && !nonRattache} />
                <FilterLink href="/emails?nonRattache=true" label="Non rattachés" count={nonRattacheCount} active={nonRattache === "true"} />
              </div>

              <h3 className="mb-2 mt-5 text-xs font-semibold uppercase tracking-wide text-gray-500">Catégorie</h3>
              <div className="space-y-1">
                {["FISCAL", "ADMIN", "SOCIAL", "JURIDIQUE", "AUTRE"].map((t) => {
                  const c = counts.find((x) => x.tagIa === t)
                  return (
                    <FilterLink
                      key={t}
                      href={`/emails?tag=${t}`}
                      label={t}
                      count={c?._count ?? 0}
                      active={tag === t}
                    />
                  )
                })}
              </div>
            </div>
          </div>

          {/* Email list */}
          <div className="min-w-0 flex-1">
            <div className="overflow-hidden rounded-lg border bg-white">
              <div className="border-b px-6 py-3">
                <p className="text-sm text-gray-500">
                  {emails.length} email{emails.length > 1 ? "s" : ""}
                  {tag && <span className="ml-1 font-medium text-gray-700">— {tag}</span>}
                  {nonRattache === "true" && <span className="ml-1 font-medium text-gray-700">— Non rattachés</span>}
                </p>
              </div>
              <EmailList emails={emails} dossiers={dossiers} />
            </div>
          </div>
        </div>
    </main>
  )
}

function FilterLink({
  href,
  label,
  count,
  active,
}: {
  href: string
  label: string
  count: number
  active: boolean
}) {
  return (
    <Link
      href={href}
      className={`flex items-center justify-between rounded-md px-3 py-1.5 text-sm ${
        active ? "bg-blue-50 font-medium text-blue-700" : "text-gray-600 hover:bg-gray-50"
      }`}
    >
      <span>{label}</span>
      <span className={`text-xs ${active ? "text-blue-500" : "text-gray-400"}`}>{count}</span>
    </Link>
  )
}
