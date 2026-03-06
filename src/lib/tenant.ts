/**
 * Helper pour récupérer le tenant actif.
 * En dev, on utilise le premier tenant trouvé.
 * En prod, ce sera déterminé par la session utilisateur.
 */

import { prisma } from "@/lib/db/prisma"

export async function getTenantId(): Promise<string> {
  // TODO: en production, extraire depuis la session NextAuth
  const tenant = await prisma.tenant.findFirst()
  if (!tenant) throw new Error("No tenant found")
  return tenant.id
}
