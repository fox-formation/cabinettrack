import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth/options"
import { prisma } from "@/lib/db/prisma"

export async function getTenantId(): Promise<string> {
  const session = await getServerSession(authOptions)
  const tenantId = (session?.user as Record<string, unknown> | undefined)?.tenantId as string | undefined

  if (tenantId) return tenantId

  // Dev fallback: use first tenant when no session (seeding, scripts)
  if (process.env.NODE_ENV === "development") {
    const tenant = await prisma.tenant.findFirst()
    if (tenant) return tenant.id
  }

  throw new Error("Unauthorized: no tenant in session")
}
