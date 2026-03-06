import { NextResponse } from "next/server"
import { prisma } from "@/lib/db/prisma"
import { getTenantId } from "@/lib/tenant"

export const dynamic = "force-dynamic"

/**
 * GET /api/import/history
 * Returns the import history for the current tenant, most recent first.
 */
export async function GET() {
  const tenantId = await getTenantId()

  const history = await prisma.$queryRaw<Array<{
    id: string
    file_name: string
    total: number
    imported: number
    errors: number
    unmapped_headers: string[]
    created_at: Date
    has_file: boolean
  }>>`
    SELECT id, file_name, total, imported, errors, unmapped_headers, created_at,
           (file_data IS NOT NULL) AS has_file
    FROM import_history
    WHERE tenant_id = ${tenantId}
    ORDER BY created_at DESC
    LIMIT 20
  `

  // Map snake_case to camelCase for frontend
  const result = history.map((h) => ({
    id: h.id,
    fileName: h.file_name,
    total: h.total,
    imported: h.imported,
    errors: h.errors,
    unmappedHeaders: h.unmapped_headers,
    createdAt: h.created_at,
    hasFile: h.has_file,
  }))

  return NextResponse.json(result)
}
