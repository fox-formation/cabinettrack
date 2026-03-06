import { withAuth } from "next-auth/middleware"
import { NextResponse } from "next/server"

const ALLOWED_DOMAINS = [
  "fiduciaire-villeurbannaise.com",
  "finatec-expertise.com",
]

export default withAuth(
  function middleware(req) {
    const email = req.nextauth.token?.email as string | undefined
    if (email) {
      const domain = email.split("@")[1]?.toLowerCase()
      if (!domain || !ALLOWED_DOMAINS.includes(domain)) {
        const url = req.nextUrl.clone()
        url.pathname = "/login"
        url.searchParams.set("error", "unauthorized")
        return NextResponse.redirect(url)
      }
    }
    return NextResponse.next()
  },
  {
    callbacks: {
      authorized: ({ token }) => !!token,
    },
  },
)

export const config = {
  matcher: [
    "/((?!login|register|forgot-password|reset-password|auth/confirm|auth/reset-password|api/auth|_next/static|_next/image|favicon.ico).*)",
  ],
}
