"use client"

export const dynamic = "force-dynamic"

import { useState } from "react"
import Link from "next/link"
import { createClient } from "@supabase/supabase-js"

const ALLOWED_DOMAINS = ["fiduciaire-villeurbannaise.com", "finatec-expertise.com"]

export default function RegisterPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [error, setError] = useState("")
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")

    // Validate domain
    const domain = email.split("@")[1]?.toLowerCase()
    if (!domain || !ALLOWED_DOMAINS.includes(domain)) {
      setError("Accès réservé aux collaborateurs du cabinet.")
      return
    }

    // Validate password
    if (password.length < 8) {
      setError("Le mot de passe doit contenir au moins 8 caractères.")
      return
    }

    if (password !== confirm) {
      setError("Les mots de passe ne correspondent pas.")
      return
    }

    setLoading(true)
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    )
    const { error: signUpError } = await supabase.auth.signUp({ email, password })
    setLoading(false)

    if (signUpError) {
      setError(signUpError.message)
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
          <h1 className="text-lg font-semibold text-gray-800">Créer un compte</h1>
          <p className="mt-1 text-xs text-gray-400">
            Inscription réservée aux collaborateurs du cabinet
          </p>
        </div>

        {success ? (
          <div className="space-y-4">
            <div className="rounded border border-green-200 bg-green-50 px-3 py-3 text-xs text-green-700">
              Vérifiez votre email pour confirmer votre compte. Un lien de confirmation vous a été envoyé.
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

            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Mot de passe</label>
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
              {loading ? "Inscription..." : "Créer mon compte"}
            </button>

            <p className="text-center text-xs text-gray-400">
              Déjà un compte ?{" "}
              <Link href="/login" className="text-gray-600 hover:underline">
                Se connecter
              </Link>
            </p>
          </form>
        )}
      </div>
    </div>
  )
}
