/**
 * Microsoft Graph API — Email operations.
 * Scopes requis : Mail.Read | Mail.ReadWrite | offline_access | User.Read
 */

import { GraphClient } from "./client"

interface GraphEmailAddress {
  emailAddress: {
    name: string
    address: string
  }
}

interface GraphMessage {
  id: string
  subject: string
  bodyPreview: string
  body: {
    contentType: string
    content: string
  }
  from: GraphEmailAddress
  toRecipients: GraphEmailAddress[]
  receivedDateTime: string
  isRead: boolean
}

interface GraphMessagesResponse {
  value: GraphMessage[]
  "@odata.nextLink"?: string
}

export interface ParsedEmail {
  microsoftMessageId: string
  expediteur: string
  expediteurEmail: string
  destinataires: string[]
  sujet: string
  corpsTexte: string
  dateReception: Date
}

/**
 * Récupère les derniers emails (non lus en priorité).
 */
export async function fetchEmails(
  client: GraphClient,
  top: number = 50
): Promise<ParsedEmail[]> {
  // Fetch non lus d'abord, puis les plus récents
  const response = await client.request<GraphMessagesResponse>(
    `/me/messages?$top=${top}&$orderby=receivedDateTime desc&$select=id,subject,bodyPreview,body,from,toRecipients,receivedDateTime,isRead`
  )

  return response.value.map((msg) => ({
    microsoftMessageId: msg.id,
    expediteur: msg.from?.emailAddress?.name ?? "Inconnu",
    expediteurEmail: msg.from?.emailAddress?.address ?? "",
    destinataires: msg.toRecipients?.map((r) => r.emailAddress.address) ?? [],
    sujet: msg.subject ?? "(sans sujet)",
    corpsTexte: stripHtml(msg.body?.content ?? msg.bodyPreview ?? ""),
    dateReception: new Date(msg.receivedDateTime),
  }))
}

/**
 * Récupère un email spécifique par ID.
 */
export async function fetchEmailById(
  client: GraphClient,
  messageId: string
): Promise<ParsedEmail> {
  const msg = await client.request<GraphMessage>(
    `/me/messages/${messageId}?$select=id,subject,bodyPreview,body,from,toRecipients,receivedDateTime,isRead`
  )

  return {
    microsoftMessageId: msg.id,
    expediteur: msg.from?.emailAddress?.name ?? "Inconnu",
    expediteurEmail: msg.from?.emailAddress?.address ?? "",
    destinataires: msg.toRecipients?.map((r) => r.emailAddress.address) ?? [],
    sujet: msg.subject ?? "(sans sujet)",
    corpsTexte: stripHtml(msg.body?.content ?? msg.bodyPreview ?? ""),
    dateReception: new Date(msg.receivedDateTime),
  }
}

/**
 * Envoie un email.
 */
export async function sendEmail(
  client: GraphClient,
  to: string,
  subject: string,
  body: string
): Promise<void> {
  await client.request("/me/sendMail", {
    method: "POST",
    body: JSON.stringify({
      message: {
        subject,
        body: { contentType: "Text", content: body },
        toRecipients: [{ emailAddress: { address: to } }],
      },
      saveToSentItems: true,
    }),
  })
}

/**
 * Marque un email comme lu.
 */
export async function markAsRead(
  client: GraphClient,
  messageId: string
): Promise<void> {
  await client.request(`/me/messages/${messageId}`, {
    method: "PATCH",
    body: JSON.stringify({ isRead: true }),
  })
}

/**
 * Crée un abonnement webhook pour les nouveaux emails.
 * La subscription doit être renouvelée toutes les ~3 jours pour Graph.
 */
export async function createMailSubscription(
  client: GraphClient,
  notificationUrl: string,
  expirationMinutes: number = 4230 // ~2.9 jours (max Graph)
): Promise<{ id: string; expirationDateTime: string }> {
  const expiration = new Date(Date.now() + expirationMinutes * 60 * 1000)

  const result = await client.request<{ id: string; expirationDateTime: string }>(
    "/subscriptions",
    {
      method: "POST",
      body: JSON.stringify({
        changeType: "created",
        notificationUrl,
        resource: "me/mailFolders/inbox/messages",
        expirationDateTime: expiration.toISOString(),
        clientState: "cabinettrack-webhook-secret",
      }),
    }
  )

  return result
}

/**
 * Strip HTML tags to get plain text.
 */
function stripHtml(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim()
}
