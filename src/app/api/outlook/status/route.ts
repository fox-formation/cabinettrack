import { NextResponse } from "next/server"
import { prisma } from "@/lib/db/prisma"
import { getTenantId } from "@/lib/tenant"

export const dynamic = "force-dynamic"

/**
 * GET /api/outlook/status
 * Returns Outlook connection status for the current tenant.
 */
export async function GET() {
  const tenantId = await getTenantId()

  const conn = await prisma.outlookConnection.findUnique({
    where: { tenantId },
    select: {
      userEmail: true,
      connectedAt: true,
      expiresAt: true,
    },
  })

  if (!conn) {
    return NextResponse.json({ connected: false })
  }

  return NextResponse.json({
    connected: true,
    userEmail: conn.userEmail,
    connectedAt: conn.connectedAt,
    tokenValid: conn.expiresAt > new Date(),
  })
}
