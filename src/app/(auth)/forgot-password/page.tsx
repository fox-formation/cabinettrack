"use client"

import { useState } from "react"
import Link from "next/link"
import { supabase } from "@/lib/supabase"

const ALLOWED_DOMAINS = ["fiduciaire-villeurbannaise.com", "finatec-expertise.com"]

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("")
  const [error, setError] = useState("")
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")

    const domain = email.split("@")[1]?.toLowerCase()
    if (!domain || !ALLOWED_DOMAINS.includes(domain)) {
      setError("Accès réservé aux collaborateurs du cabinet.")
      return
    }

    setLoading(true)
    const redirectTo = `${window.location.origin}/auth/reset-password`
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, { redirectTo })
    setLoading(false)

    if (resetError) {
      setError(resetError.message)
      return
    }

    setSuccess(true)
  }

  return (
    <div className="flex min-h-screen items-center justify-center" style={{ backgroundColor: "#F9F7F4" }}>
      <div className="w-full max-w-sm rounded border border-gray-200 bg-white p-8">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-lg text-sm font-bold text-white" style={{ backgroundColor: "#D4724A" }}>
            CT
          </div>
          <h1 className="text-lg font-semibold text-gray-800">Mot de passe oublié</h1>
          <p className="mt-1 text-xs text-gray-400">
            Entrez votre email pour recevoir un lien de réinitialisation
          </p>
        </div>

        {success ? (
          <div className="space-y-4">
            <div className="rounded border border-green-200 bg-green-50 px-3 py-3 text-xs text-green-700">
              Un email vous a été envoyé avec un lien de réinitialisation.
            </div>
            <Link
              href="/login"
              className="block text-center text-xs text-gray-500 hover:text-gray-700"
            >
              Retour à la connexion
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
              <label className="mb-1 block text-xs font-medium text-gray-600">Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="prenom@fiduciaire-villeurbannaise.com"
                className="w-full rounded border border-gray-200 px-3 py-2 text-xs text-gray-700 placeholder-gray-300 focus:border-gray-400 focus:outline-none"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50"
            >
              {loading ? "Envoi..." : "Envoyer le lien de réinitialisation"}
            </button>

            <p className="text-center text-xs text-gray-400">
              <Link href="/login" className="text-gray-600 hover:underline">
                Retour à la connexion
              </Link>
            </p>
          </form>
        )}
      </div>
    </div>
  )
}
