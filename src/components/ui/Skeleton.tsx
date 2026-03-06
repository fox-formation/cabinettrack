export function SkeletonCard() {
  return (
    <div className="animate-pulse rounded-lg border bg-white p-5">
      <div className="mb-3 h-3 w-24 rounded bg-gray-200" />
      <div className="h-8 w-16 rounded bg-gray-200" />
    </div>
  )
}

export function SkeletonTable({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div className="animate-pulse overflow-hidden rounded-lg border bg-white">
      <div className="border-b bg-gray-50 p-4">
        <div className="flex gap-4">
          {Array.from({ length: cols }, (_, i) => (
            <div key={i} className="h-3 flex-1 rounded bg-gray-200" />
          ))}
        </div>
      </div>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="border-b p-4 last:border-0">
          <div className="flex gap-4">
            {Array.from({ length: cols }, (_, j) => (
              <div key={j} className="h-3 flex-1 rounded bg-gray-200" />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
