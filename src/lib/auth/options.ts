import { NextAuthOptions } from "next-auth"
import AzureADProvider from "next-auth/providers/azure-ad"
import CredentialsProvider from "next-auth/providers/credentials"
import { createClient } from "@supabase/supabase-js"
import { prisma } from "@/lib/db/prisma"

// Hardcoded fallback domains (used if DB is unreachable)
const FALLBACK_DOMAINS = [
  "fiduciaire-villeurbannaise.com",
  "fiduciaire-villeurbannaise.fr",
  "fiduciaire.villeurbannaise.fr",
  "finatec-expertise.com",
  "finatec-expertise.fr",
]

async function isAllowedDomain(email: string): Promise<boolean> {
  const domain = email.split("@")[1]?.toLowerCase()
  if (!domain) return false

  // Check from DB first (multi-tenant)
  try {
    const tenant = await prisma.tenant.findFirst({
      where: { domaines: { has: domain } },
      select: { id: true },
    })
    if (tenant) return true
  } catch {
    // DB unreachable — use fallback
  }

  return FALLBACK_DOMAINS.includes(domain)
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

        if (!await isAllowedDomain(credentials.email)) return null

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
      if (!email || !await isAllowedDomain(email)) {
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
          let dbUser = await prisma.user.findFirst({
            where: { email },
            select: { id: true, tenantId: true, role: true, numero: true, prenom: true, nom: true },
          })

          // If no user found, resolve tenant by domain then try to match existing user by prenom
          if (!dbUser) {
            const domain = email.split("@")[1]?.toLowerCase()
            if (domain) {
              const tenant = await prisma.tenant.findFirst({
                where: { domaines: { has: domain } },
              })
              if (tenant) {
                const displayName = user.name || email.split("@")[0]
                const parts = displayName.split(/\s+/)
                const prenom = parts[0] || displayName
                const nom = parts.slice(1).join(" ") || ""

                // Try to match an existing user by prenom (imported from Excel without email)
                const existingByPrenom = await prisma.user.findFirst({
                  where: {
                    tenantId: tenant.id,
                    prenom: { equals: prenom, mode: "insensitive" },
                    email: null,
                  },
                  select: { id: true, tenantId: true, role: true, numero: true, prenom: true, nom: true },
                })

                if (existingByPrenom) {
                  // Link the existing user to this email
                  dbUser = await prisma.user.update({
                    where: { id: existingByPrenom.id },
                    data: {
                      email,
                      nom: nom || existingByPrenom.nom,
                      microsoftId: account.provider === "azure-ad" ? user.id : undefined,
                    },
                    select: { id: true, tenantId: true, role: true, numero: true, prenom: true, nom: true },
                  })
                  console.log(`[auth] Linked existing user ${prenom} to email ${email}`)
                } else {
                  // Create new user
                  dbUser = await prisma.user.create({
                    data: {
                      tenantId: tenant.id,
                      email,
                      prenom,
                      nom,
                      role: "CONFIRME",
                      microsoftId: account.provider === "azure-ad" ? user.id : undefined,
                    },
                    select: { id: true, tenantId: true, role: true, numero: true, prenom: true, nom: true },
                  })
                  console.log(`[auth] Auto-provisioned new user ${email} for tenant ${tenant.nom}`)
                }
              }
            }
          }

          if (dbUser) {
            token.userId = dbUser.id
            token.tenantId = dbUser.tenantId
            token.role = dbUser.role
            token.numero = dbUser.numero ?? `${dbUser.prenom.charAt(0)}${(dbUser.nom || "").substring(0, 2)}`.toUpperCase()

            // Link Microsoft ID if not already linked
            if (user.id && account.provider === "azure-ad" && !dbUser.numero) {
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
        u.numero = token.numero ?? null
      }
      return session
    },
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
}
