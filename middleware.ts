import { NextRequest, NextResponse } from "next/server"
import { getToken } from "next-auth/jwt"

const ALLOWED_DOMAINS = [
  "fiduciaire-villeurbannaise.com",
  "finatec-expertise.com",
]

export async function middleware(request: NextRequest) {
  try {
    console.log("[middleware] path:", request.nextUrl.pathname)

    const token = await getToken({
      req: request,
      secret: process.env.NEXTAUTH_SECRET,
    })

    console.log("[middleware] token:", token ? "found" : "null")
    console.log("[middleware] NEXTAUTH_SECRET present:", !!process.env.NEXTAUTH_SECRET)

    if (!token) {
      console.log("[middleware] redirecting to login")
      return NextResponse.redirect(new URL("/login", request.url))
    }

    const email = (token.email as string) ?? ""
    const domain = email.split("@")[1]?.toLowerCase()

    if (!domain || !ALLOWED_DOMAINS.includes(domain)) {
      return NextResponse.redirect(new URL("/login?error=unauthorized", request.url))
    }

    return NextResponse.next()
  } catch (err) {
    console.error("[middleware] error:", err)
    return NextResponse.redirect(new URL("/login", request.url))
  }
}

export const config = {
  matcher: [
    "/((?!login|register|forgot-password|reset-password|auth|api/auth|_next/static|_next/image|favicon.ico).*)",
  ],
}
