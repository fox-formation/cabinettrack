import { NextRequest, NextResponse } from "next/server"
import { getToken } from "next-auth/jwt"

const ALLOWED_DOMAINS = [
  "fiduciaire-villeurbannaise.com",
  "finatec-expertise.com",
]

export async function middleware(request: NextRequest) {
  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
  })

  if (!token) {
    return NextResponse.redirect(new URL("/login", request.url))
  }

  const email = (token.email as string) ?? ""
  const domain = email.split("@")[1]?.toLowerCase()

  if (!domain || !ALLOWED_DOMAINS.includes(domain)) {
    return NextResponse.redirect(new URL("/login?error=unauthorized", request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    "/((?!login|register|forgot-password|reset-password|auth|api/auth|_next/static|_next/image|favicon.ico).*)",
  ],
}
