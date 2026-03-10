import { NextResponse } from "next/server"
import { getTenantId } from "@/lib/tenant"
import { getAuthorizationUrl } from "@/lib/graph/oauth"
import crypto from "crypto"

export const dynamic = "force-dynamic"

/**
 * GET /api/outlook/authorize
 * Redirects to Microsoft OAuth2 consent page.
 */
export async function GET() {
  try {
    const tenantId = await getTenantId()

    // State = tenantId encrypted to prevent CSRF
    const state = Buffer.from(
      JSON.stringify({ tenantId, nonce: crypto.randomBytes(16).toString("hex") })
    ).toString("base64url")

    const authUrl = getAuthorizationUrl(state)
    return NextResponse.redirect(authUrl)
  } catch (err) {
    console.error("[outlook/authorize] Error:", err)
    return NextResponse.redirect(
      new URL("/parametres?outlook=error&message=Configuration+manquante", process.env.NEXTAUTH_URL || "http://localhost:3000")
    )
  }
}
