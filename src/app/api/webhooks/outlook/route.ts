import { NextRequest, NextResponse } from "next/server"
import { GraphClient, getAppAccessToken } from "@/lib/graph/client"
import { fetchEmailById } from "@/lib/graph/emails"
import { processEmail } from "@/lib/ai/queue"
import { prisma } from "@/lib/db/prisma"

export const dynamic = "force-dynamic"

const WEBHOOK_SECRET = "cabinettrack-webhook-secret"

/**
 * POST /api/webhooks/outlook
 *
 * Réception des notifications Microsoft Graph (nouveaux emails).
 * - Validation de la souscription : retourner validationToken < 3s
 * - Notification : traiter les emails reçus
 */
export async function POST(req: NextRequest) {
  // Validation de la souscription Graph
  const validationToken = req.nextUrl.searchParams.get("validationToken")
  if (validationToken) {
    // Répondre < 3 secondes avec le token pour valider la souscription
    return new NextResponse(validationToken, {
      status: 200,
      headers: { "Content-Type": "text/plain" },
    })
  }

  // Traitement des notifications
  const body = await req.json()

  if (!body.value || !Array.isArray(body.value)) {
    return NextResponse.json({ error: "Invalid notification payload" }, { status: 400 })
  }

  // Traiter les notifications en arrière-plan
  // On répond 202 immédiatement pour respecter le timeout Graph (< 3s)
  const processPromise = handleNotifications(body.value)

  // Fire and forget — le traitement continue en arrière-plan
  processPromise.catch((err) => {
    console.error("[Webhook] Error processing notifications:", err)
  })

  return NextResponse.json({ status: "accepted" }, { status: 202 })
}

interface GraphNotification {
  subscriptionId: string
  clientState: string
  resource: string
  resourceData: {
    id: string
    "@odata.type": string
  }
}

async function handleNotifications(notifications: GraphNotification[]): Promise<void> {
  for (const notification of notifications) {
    // Vérifier le clientState pour la sécurité
    if (notification.clientState !== WEBHOOK_SECRET) {
      console.warn("[Webhook] Invalid clientState, skipping notification")
      continue
    }

    try {
      // Obtenir le token app
      const accessToken = await getAppAccessToken()
      const client = new GraphClient({ accessToken })

      // Extraire le messageId depuis le resource path
      const messageId = notification.resourceData?.id
      if (!messageId) continue

      // Fetch l'email complet
      const parsed = await fetchEmailById(client, messageId)

      // Trouver le tenant (pour l'instant, premier tenant)
      // En prod, on liera la subscription à un tenant spécifique
      const tenant = await prisma.tenant.findFirst()
      if (!tenant) {
        console.error("[Webhook] No tenant found")
        return
      }

      // Traiter l'email (classification + résumé + sauvegarde)
      await processEmail(tenant.id, parsed)
    } catch (err) {
      console.error("[Webhook] Error processing message:", err)
    }
  }
}
