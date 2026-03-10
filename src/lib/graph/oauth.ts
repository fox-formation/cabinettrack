/**
 * OAuth2 delegated flow for Microsoft Graph.
 * No admin consent required — user authorizes access to their own mailbox.
 *
 * Scopes: Mail.Read, Mail.ReadWrite, offline_access, User.Read
 */

import { prisma } from "@/lib/db/prisma"

const MICROSOFT_AUTH_URL = "https://login.microsoftonline.com/common/oauth2/v2.0"
const SCOPES = "Mail.Read Mail.ReadWrite offline_access User.Read"

function getClientId(): string {
  const id = process.env.OUTLOOK_CLIENT_ID
  if (!id) throw new Error("OUTLOOK_CLIENT_ID is not configured")
  return id
}

function getClientSecret(): string {
  const secret = process.env.OUTLOOK_CLIENT_SECRET
  if (!secret) throw new Error("OUTLOOK_CLIENT_SECRET is not configured")
  return secret
}

function getRedirectUri(): string {
  const base = process.env.NEXTAUTH_URL || "http://localhost:3000"
  return `${base}/api/outlook/callback`
}

/**
 * Generates the Microsoft OAuth2 authorization URL.
 */
export function getAuthorizationUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: getClientId(),
    response_type: "code",
    redirect_uri: getRedirectUri(),
    response_mode: "query",
    scope: SCOPES,
    state,
  })
  return `${MICROSOFT_AUTH_URL}/authorize?${params.toString()}`
}

/**
 * Exchanges authorization code for tokens.
 */
export async function exchangeCodeForTokens(code: string): Promise<{
  accessToken: string
  refreshToken: string
  expiresIn: number
  userEmail: string
}> {
  const body = new URLSearchParams({
    client_id: getClientId(),
    client_secret: getClientSecret(),
    code,
    redirect_uri: getRedirectUri(),
    grant_type: "authorization_code",
    scope: SCOPES,
  })

  const res = await fetch(`${MICROSOFT_AUTH_URL}/token`, {
    method: "POST",
    body,
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Token exchange failed: ${err}`)
  }

  const data = await res.json()

  // Get user email from Graph API
  const meRes = await fetch("https://graph.microsoft.com/v1.0/me", {
    headers: { Authorization: `Bearer ${data.access_token}` },
  })
  const me = meRes.ok ? await meRes.json() : { mail: null, userPrincipalName: null }

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresIn: data.expires_in,
    userEmail: me.mail || me.userPrincipalName || "unknown",
  }
}

/**
 * Refreshes an expired access token using the refresh token.
 */
export async function refreshAccessToken(refreshToken: string): Promise<{
  accessToken: string
  refreshToken: string
  expiresIn: number
}> {
  const body = new URLSearchParams({
    client_id: getClientId(),
    client_secret: getClientSecret(),
    refresh_token: refreshToken,
    grant_type: "refresh_token",
    scope: SCOPES,
  })

  const res = await fetch(`${MICROSOFT_AUTH_URL}/token`, {
    method: "POST",
    body,
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Token refresh failed: ${err}`)
  }

  const data = await res.json()
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token || refreshToken,
    expiresIn: data.expires_in,
  }
}

/**
 * Gets a valid access token for a tenant, refreshing if needed.
 */
export async function getValidAccessToken(tenantId: string): Promise<string> {
  const conn = await prisma.outlookConnection.findUnique({
    where: { tenantId },
  })

  if (!conn) {
    throw new Error("Outlook not connected for this tenant")
  }

  // If token still valid (with 5 min buffer)
  if (conn.expiresAt > new Date(Date.now() + 5 * 60 * 1000)) {
    return conn.accessToken
  }

  // Refresh the token
  const refreshed = await refreshAccessToken(conn.refreshToken)

  await prisma.outlookConnection.update({
    where: { tenantId },
    data: {
      accessToken: refreshed.accessToken,
      refreshToken: refreshed.refreshToken,
      expiresAt: new Date(Date.now() + refreshed.expiresIn * 1000),
    },
  })

  return refreshed.accessToken
}
