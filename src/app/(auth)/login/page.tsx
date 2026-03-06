"use client"

import { signIn } from "next-auth/react"

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="w-full max-w-md space-y-8 rounded-xl bg-white p-8 shadow-lg">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900">CabinetTrack</h1>
          <p className="mt-2 text-sm text-gray-600">
            Connectez-vous pour accéder à votre espace cabinet
          </p>
        </div>

        <button
          onClick={() => signIn("azure-ad", { callbackUrl: "/" })}
          className="flex w-full items-center justify-center gap-3 rounded-lg bg-blue-600 px-4 py-3 text-white transition-colors hover:bg-blue-700"
        >
          <svg className="h-5 w-5" viewBox="0 0 21 21" fill="currentColor">
            <path d="M0 0h10v10H0zM11 0h10v10H11zM0 11h10v10H0zM11 11h10v10H11z" />
          </svg>
          Se connecter avec Microsoft
        </button>
      </div>
    </div>
  )
}
