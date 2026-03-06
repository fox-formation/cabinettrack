import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db/prisma"
import { getTenantId } from "@/lib/tenant"

export const dynamic = "force-dynamic"

/**
 * GET /api/import/download/[id]
 * Télécharge le fichier Excel stocké lors d'un import précédent.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const tenantId = await getTenantId()

  const entry = await prisma.importHistory.findFirst({
    where: { id: params.id, tenantId },
    select: { fileName: true, fileData: true },
  })

  if (!entry || !entry.fileData) {
    return NextResponse.json({ error: "Fichier non trouvé" }, { status: 404 })
  }

  return new NextResponse(new Uint8Array(entry.fileData), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${entry.fileName}"`,
    },
  })
}
