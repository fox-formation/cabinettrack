import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"
import { authOptions } from "@/lib/auth/options"
import { prisma } from "@/lib/db/prisma"
import { getTenantId } from "@/lib/tenant"
import DashboardShell from "@/components/layout/DashboardShell"

export const dynamic = "force-dynamic"

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getServerSession(authOptions)
  if (!session) {
    redirect("/login")
  }

  let alertesCount = 0
  let emailsNonLus = 0

  try {
    const tenantId = await getTenantId()
    const [alertes, emails, actionsOuvertes] = await Promise.all([
      prisma.alerte.count({
        where: { tenantId, acquittee: false, niveau: { in: ["WARNING", "URGENT", "CRITIQUE"] } },
      }),
      prisma.email.count({
        where: { tenantId, valide: false },
      }),
      prisma.suiviRevision.count({
        where: {
          tenantId,
          statut: { in: ["ACTION_CABINET", "ACTION_CLIENT", "ACTION_REQUISE", "DEMANDE_CLIENT"] },
          dateReponse: null,
        },
      }),
    ])
    alertesCount = alertes + actionsOuvertes
    emailsNonLus = emails
  } catch {
    // No tenant yet — badges at 0
  }

  return (
    <DashboardShell alertesCount={alertesCount} emailsNonLus={emailsNonLus}>
      {children}
    </DashboardShell>
  )
}
