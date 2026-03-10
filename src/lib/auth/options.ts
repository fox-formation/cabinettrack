import { NextAuthOptions } from "next-auth"
import AzureADProvider from "next-auth/providers/azure-ad"
import CredentialsProvider from "next-auth/providers/credentials"
import { createClient } from "@supabase/supabase-js"
import { prisma } from "@/lib/db/prisma"

const ALLOWED_DOMAINS = [
  "fiduciaire-villeurbannaise.com",
  "fiduciaire-villeurbannaise.fr",
  "fiduciaire.villeurbannaise.fr",
  "finatec-expertise.com",
  "finatec-expertise.fr",
]

function isAllowedDomain(email: string): boolean {
  const domain = email.split("@")[1]?.toLowerCase()
  return !!domain && ALLOWED_DOMAINS.includes(domain)
}

console.log("[auth] NEXTAUTH_SECRET present:", !!process.env.NEXTAUTH_SECRET)

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "Email",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Mot de passe", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null

        if (!isAllowedDomain(credentials.email)) return null

        const supabase = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        )

        const { data, error } = await supabase.auth.signInWithPassword({
          email: credentials.email,
          password: credentials.password,
        })

        if (error || !data.user) return null

        return {
          id: data.user.id,
          email: data.user.email,
          name: data.user.user_metadata?.name ?? data.user.email?.split("@")[0],
        }
      },
    }),
    ...(process.env.AZURE_CLIENT_ID
      ? [
          AzureADProvider({
            clientId: process.env.AZURE_CLIENT_ID,
            clientSecret: process.env.AZURE_CLIENT_SECRET!,
            tenantId: process.env.AZURE_TENANT_ID!,
          }),
        ]
      : []),
  ],
  session: {
    strategy: "jwt",
  },
  callbacks: {
    async signIn({ user, account }) {
      // Credentials provider already validates domain in authorize()
      if (account?.provider === "credentials") return true

      // Azure AD: check domain
      const email = user.email
      if (!email || !isAllowedDomain(email)) {
        return "/login?error=unauthorized"
      }
      return true
    },

    async jwt({ token, user, account }) {
      if (user && account) {
        token.email = user.email
        token.name = user.name

        // Find or create the user in our DB and attach tenant
        const email = user.email
        if (email) {
          const dbUser = await prisma.user.findFirst({
            where: { email },
            select: { id: true, tenantId: true, role: true },
          })
          if (dbUser) {
            token.userId = dbUser.id
            token.tenantId = dbUser.tenantId
            token.role = dbUser.role

            // Link Microsoft ID if not already linked
            if (user.id && !await prisma.user.findUnique({ where: { microsoftId: user.id } })) {
              await prisma.user.update({
                where: { id: dbUser.id },
                data: { microsoftId: user.id },
              }).catch(() => {})
            }
          }
        }
      }
      return token
    },

    async session({ session, token }) {
      if (session.user) {
        const u = session.user as Record<string, unknown>
        u.id = token.userId ?? null
        u.tenantId = token.tenantId ?? null
        u.role = token.role ?? null
        u.email = token.email ?? null
      }
      return session
    },
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
}
