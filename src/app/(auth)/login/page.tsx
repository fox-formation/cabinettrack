"use client"

import { signIn } from "next-auth/react"
import { useSearchParams } from "next/navigation"
import { useState, Suspense } from "react"
import Link from "next/link"

function LoginContent() {
  const searchParams = useSearchParams()
  const error = searchParams.get("error")
  const confirmed = searchParams.get("confirmed")
  const reset = searchParams.get("reset")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [loginError, setLoginError] = useState("")

  const handleCredentialsLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoginError("")
    setLoading(true)

    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
    })

    setLoading(false)

    if (result?.error) {
      setLoginError("Email ou mot de passe incorrect.")
      return
    }

    window.location.href = "/"
  }

  return (
    <div className="flex min-h-screen items-center justify-center" style={{ backgroundColor: "#F9F7F4" }}>
      <div className="w-full max-w-sm space-y-6 rounded border border-gray-200 bg-white p-8">
        <div className="text-center">
          <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-lg text-sm font-bold text-white" style={{ backgroundColor: "#D4724A" }}>
            CT
          </div>
          <h1 className="text-lg font-semibold text-gray-800">CabinetTrack</h1>
          <p className="mt-1 text-xs text-gray-400">
            Connectez-vous pour accéder à votre espace cabinet
          </p>
        </div>

        {confirmed === "true" && (
          <div className="rounded border border-green-200 bg-green-50 px-3 py-2 text-xs text-green-700">
            Compte confirmé ! Vous pouvez vous connecter.
          </div>
        )}
        {reset === "true" && (
          <div className="rounded border border-green-200 bg-green-50 px-3 py-2 text-xs text-green-700">
            Mot de passe modifié avec succès !
          </div>
        )}
        {error === "unauthorized" && (
          <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">
            Accès réservé aux collaborateurs du cabinet.
          </div>
        )}
        {error === "confirmation_failed" && (
          <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">
            Le lien de confirmation est invalide ou a expiré.
          </div>
        )}
        {error && error !== "unauthorized" && error !== "confirmation_failed" && (
          <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">
            Erreur de connexion. Veuillez réessayer.
          </div>
        )}
        {loginError && (
          <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">
            {loginError}
          </div>
        )}

        <form onSubmit={handleCredentialsLogin} className="space-y-3">
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
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Votre mot de passe"
              className="w-full rounded border border-gray-200 px-3 py-2 text-xs text-gray-700 placeholder-gray-300 focus:border-gray-400 focus:outline-none"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50"
          >
            {loading ? "Connexion..." : "Se connecter"}
          </button>
        </form>

        <div className="flex items-center gap-3">
          <div className="h-px flex-1 bg-gray-200" />
          <span className="text-[10px] text-gray-300">ou</span>
          <div className="h-px flex-1 bg-gray-200" />
        </div>

        <button
          onClick={() => signIn("azure-ad", { callbackUrl: "/" })}
          className="flex w-full items-center justify-center gap-2 rounded border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
        >
          <svg className="h-4 w-4" viewBox="0 0 21 21" fill="currentColor">
            <path d="M0 0h10v10H0zM11 0h10v10H11zM0 11h10v10H0zM11 11h10v10H11z" />
          </svg>
          Se connecter avec Microsoft
        </button>

        <div className="flex items-center justify-between">
          <Link href="/register" className="text-xs text-gray-400 hover:text-gray-600">
            Créer un compte
          </Link>
          <Link href="/forgot-password" className="text-xs text-gray-400 hover:text-gray-600">
            Mot de passe oublié ?
          </Link>
        </div>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center" style={{ backgroundColor: "#F9F7F4" }}>
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-gray-400 border-t-transparent" />
      </div>
    }>
      <LoginContent />
    </Suspense>
  )
}
