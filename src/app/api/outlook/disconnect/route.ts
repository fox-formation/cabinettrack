import { NextResponse } from "next/server"
import { prisma } from "@/lib/db/prisma"
import { getTenantId } from "@/lib/tenant"

export const dynamic = "force-dynamic"

/**
 * POST /api/outlook/disconnect
 * Removes the Outlook connection for the current tenant.
 */
export async function POST() {
  const tenantId = await getTenantId()

  await prisma.outlookConnection.deleteMany({
    where: { tenantId },
  })

  return NextResponse.json({ ok: true })
}
