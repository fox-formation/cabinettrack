"use client"

export const dynamic = "force-dynamic"

import { useState, useEffect, Suspense } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import Link from "next/link"
import { createClient } from "@supabase/supabase-js"

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )
}

function ResetPasswordContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [verified, setVerified] = useState(false)
  const [verifying, setVerifying] = useState(true)

  useEffect(() => {
    const tokenHash = searchParams.get("token_hash")
    const type = searchParams.get("type")

    if (tokenHash && type === "recovery") {
      getSupabase().auth
        .verifyOtp({ token_hash: tokenHash, type: "recovery" })
        .then(({ error: verifyError }) => {
          if (verifyError) {
            setError("Lien invalide ou expiré. Recommencez.")
          } else {
            setVerified(true)
          }
          setVerifying(false)
        })
    } else {
      setError("Lien invalide ou expiré. Recommencez.")
      setVerifying(false)
    }
  }, [searchParams])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")

    if (password.length < 8) {
      setError("Le mot de passe doit contenir au moins 8 caractères.")
      return
    }

    if (password !== confirm) {
      setError("Les mots de passe ne correspondent pas.")
      return
    }

    setLoading(true)
    const { error: updateError } = await getSupabase().auth.updateUser({ password })
    setLoading(false)

    if (updateError) {
      setError(updateError.message)
      return
    }

    router.push("/login?reset=true")
  }

  return (
    <div className="flex min-h-screen items-center justify-center" style={{ backgroundColor: "#F9F7F4" }}>
      <div className="w-full max-w-sm rounded border border-gray-200 bg-white p-8">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-lg text-sm font-bold text-white" style={{ backgroundColor: "#D4724A" }}>
            CT
          </div>
          <h1 className="text-lg font-semibold text-gray-800">Nouveau mot de passe</h1>
          <p className="mt-1 text-xs text-gray-400">
            Choisissez un nouveau mot de passe
          </p>
        </div>

        {verifying ? (
          <div className="flex justify-center py-8">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-gray-400 border-t-transparent" />
          </div>
        ) : !verified ? (
          <div className="space-y-4">
            <div className="rounded border border-red-200 bg-red-50 px-3 py-3 text-xs text-red-600">
              {error || "Lien invalide ou expiré. Recommencez."}
            </div>
            <Link
              href="/forgot-password"
              className="block text-center text-xs text-gray-500 hover:text-gray-700"
            >
              Demander un nouveau lien
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">
                {error}
              </div>
            )}

            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Nouveau mot de passe</label>
              <input
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="8 caractères minimum"
                className="w-full rounded border border-gray-200 px-3 py-2 text-xs text-gray-700 placeholder-gray-300 focus:border-gray-400 focus:outline-none"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Confirmer le mot de passe</label>
              <input
                type="password"
                required
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="Confirmez votre mot de passe"
                className="w-full rounded border border-gray-200 px-3 py-2 text-xs text-gray-700 placeholder-gray-300 focus:border-gray-400 focus:outline-none"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50"
            >
              {loading ? "Modification..." : "Modifier le mot de passe"}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center" style={{ backgroundColor: "#F9F7F4" }}>
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-gray-400 border-t-transparent" />
      </div>
    }>
      <ResetPasswordContent />
    </Suspense>
  )
}
