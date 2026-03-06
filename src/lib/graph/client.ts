/**
 * Microsoft Graph API client.
 * Chaque tenant connecte son propre compte Azure AD.
 * Le token est obtenu via l'OAuth flow (client_credentials ou on-behalf-of).
 */

const GRAPH_BASE_URL = "https://graph.microsoft.com/v1.0"

interface GraphClientOptions {
  accessToken: string
}

export class GraphClient {
  private accessToken: string

  constructor({ accessToken }: GraphClientOptions) {
    this.accessToken = accessToken
  }

  async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const url = `${GRAPH_BASE_URL}${path}`
    const res = await fetch(url, {
      ...options,
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        "Content-Type": "application/json",
        ...options.headers,
      },
    })

    if (!res.ok) {
      const errorBody = await res.text()
      throw new Error(`Graph API error ${res.status}: ${errorBody}`)
    }

    return res.json() as Promise<T>
  }
}

/**
 * Obtient un access token via client_credentials flow (app-only).
 * Utilisé pour les webhooks et le traitement en arrière-plan.
 */
export async function getAppAccessToken(): Promise<string> {
  const tenantId = process.env.AZURE_TENANT_ID
  const clientId = process.env.AZURE_CLIENT_ID
  const clientSecret = process.env.AZURE_CLIENT_SECRET

  if (!tenantId || !clientId || !clientSecret) {
    throw new Error("Missing Azure AD configuration (AZURE_TENANT_ID, AZURE_CLIENT_ID, AZURE_CLIENT_SECRET)")
  }

  const tokenUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`

  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: clientId,
    client_secret: clientSecret,
    scope: "https://graph.microsoft.com/.default",
  })

  const res = await fetch(tokenUrl, {
    method: "POST",
    body,
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Failed to get access token: ${err}`)
  }

  const data = await res.json()
  return data.access_token
}
