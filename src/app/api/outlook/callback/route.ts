import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db/prisma"
import { exchangeCodeForTokens } from "@/lib/graph/oauth"

export const dynamic = "force-dynamic"

/**
 * GET /api/outlook/callback
 * Microsoft redirects here after user consents.
 */
export async function GET(req: NextRequest) {
  const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000"

  const code = req.nextUrl.searchParams.get("code")
  const stateParam = req.nextUrl.searchParams.get("state")
  const error = req.nextUrl.searchParams.get("error")

  if (error) {
    const desc = req.nextUrl.searchParams.get("error_description") || error
    console.error("[outlook/callback] OAuth error:", desc)
    return NextResponse.redirect(
      new URL(`/parametres?outlook=error&message=${encodeURIComponent(desc)}`, baseUrl)
    )
  }

  if (!code || !stateParam) {
    return NextResponse.redirect(
      new URL("/parametres?outlook=error&message=Paramètres+manquants", baseUrl)
    )
  }

  // Decode state to get tenantId
  let tenantId: string
  try {
    const state = JSON.parse(Buffer.from(stateParam, "base64url").toString())
    tenantId = state.tenantId
    if (!tenantId) throw new Error("No tenantId in state")
  } catch {
    return NextResponse.redirect(
      new URL("/parametres?outlook=error&message=State+invalide", baseUrl)
    )
  }

  try {
    // Exchange code for tokens
    const tokens = await exchangeCodeForTokens(code)

    // Store in DB (upsert — replace existing connection)
    await prisma.outlookConnection.upsert({
      where: { tenantId },
      update: {
        userEmail: tokens.userEmail,
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresAt: new Date(Date.now() + tokens.expiresIn * 1000),
      },
      create: {
        tenantId,
        userEmail: tokens.userEmail,
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresAt: new Date(Date.now() + tokens.expiresIn * 1000),
      },
    })

    return NextResponse.redirect(
      new URL(`/parametres?outlook=success&email=${encodeURIComponent(tokens.userEmail)}`, baseUrl)
    )
  } catch (err) {
    console.error("[outlook/callback] Token exchange error:", err)
    return NextResponse.redirect(
      new URL("/parametres?outlook=error&message=Erreur+lors+de+la+connexion", baseUrl)
    )
  }
}
