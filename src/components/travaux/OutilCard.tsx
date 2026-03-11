"use client"

interface OutilCardProps {
  nom: string
  description: string
  icone: string
  onLancer: () => void
  disabled?: boolean
}

export default function OutilCard({ nom, description, icone, onLancer, disabled }: OutilCardProps) {
  return (
    <div className="flex flex-col justify-between rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md">
      <div>
        <div className="mb-3 flex items-center gap-3">
          <span className="text-2xl">{icone}</span>
          <h3 className="text-base font-semibold text-gray-900">{nom}</h3>
        </div>
        <p className="mb-4 text-sm text-gray-500">{description}</p>
      </div>
      <button
        onClick={onLancer}
        disabled={disabled}
        className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        Lancer
      </button>
    </div>
  )
}
