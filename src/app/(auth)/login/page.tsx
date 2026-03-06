"use client"

import { signIn } from "next-auth/react"
import { useSearchParams } from "next/navigation"
import { Suspense } from "react"
import Link from "next/link"

function LoginContent() {
  const searchParams = useSearchParams()
  const error = searchParams.get("error")
  const confirmed = searchParams.get("confirmed")
  const reset = searchParams.get("reset")

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
