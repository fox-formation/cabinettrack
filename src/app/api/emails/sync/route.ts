import { NextResponse } from "next/server"
import { getTenantId } from "@/lib/tenant"
import { getValidAccessToken } from "@/lib/graph/oauth"
import { GraphClient } from "@/lib/graph/client"
import { fetchEmails } from "@/lib/graph/emails"
import { processEmailBatch } from "@/lib/ai/queue"

export const dynamic = "force-dynamic"

/**
 * POST /api/emails/sync
 * Manually syncs recent emails from Outlook for the current tenant.
 * Uses the delegated OAuth2 token stored in OutlookConnection.
 */
export async function POST() {
  const tenantId = await getTenantId()

  try {
    // Get valid access token (refreshes if expired)
    const accessToken = await getValidAccessToken(tenantId)
    const client = new GraphClient({ accessToken })

    // Fetch latest 50 emails
    const emails = await fetchEmails(client, 50)

    if (emails.length === 0) {
      return NextResponse.json({ synced: 0, processed: 0, message: "Aucun email trouvé" })
    }

    // Process through AI pipeline (classify + summarize + save)
    const hasAnthropicKey = !!process.env.ANTHROPIC_API_KEY
    let results

    if (hasAnthropicKey) {
      results = await processEmailBatch(tenantId, emails)
    } else {
      // Without AI key, just save emails without classification
      const { prisma } = await import("@/lib/db/prisma")
      results = []

      for (const email of emails) {
        // Skip already imported
        const existing = await prisma.email.findUnique({
          where: { microsoftMessageId: email.microsoftMessageId },
        })
        if (existing) {
          results.push({ emailId: existing.id, microsoftMessageId: email.microsoftMessageId, isNew: false })
          continue
        }

        const saved = await prisma.email.create({
          data: {
            tenantId,
            microsoftMessageId: email.microsoftMessageId,
            expediteur: `${email.expediteur} <${email.expediteurEmail}>`,
            destinataires: email.destinataires,
            sujet: email.sujet,
            corpsTexte: email.corpsTexte,
            dateReception: email.dateReception,
          },
        })
        results.push({ emailId: saved.id, microsoftMessageId: email.microsoftMessageId, isNew: true })
      }
    }

    const newEmails = results.filter((r) => "isNew" in r ? r.isNew : !("categorie" in r && r.categorie === null))

    return NextResponse.json({
      synced: emails.length,
      newEmails: newEmails.length,
      total: results.length,
      message: `${newEmails.length} nouveau(x) email(s) importé(s) sur ${emails.length} récupérés`,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erreur inconnue"
    console.error("[emails/sync] Error:", message)

    if (message.includes("not connected")) {
      return NextResponse.json({ error: "Outlook non connecté. Allez dans Paramètres pour connecter votre compte." }, { status: 400 })
    }

    if (message.includes("refresh failed")) {
      return NextResponse.json({ error: "Session Outlook expirée. Reconnectez votre compte dans Paramètres." }, { status: 401 })
    }

    return NextResponse.json({ error: message }, { status: 500 })
  }
}
