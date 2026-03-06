import { SkeletonTable } from "@/components/ui/Skeleton"

export default function DossiersLoading() {
  return (
    <main className="p-8">
      <div className="mb-6">
        <div className="h-7 w-32 animate-pulse rounded bg-gray-200" />
        <div className="mt-2 h-4 w-56 animate-pulse rounded bg-gray-200" />
      </div>
      <div className="mb-6 flex gap-3">
        <div className="h-10 w-64 animate-pulse rounded bg-gray-200" />
        <div className="h-10 w-40 animate-pulse rounded bg-gray-200" />
        <div className="h-10 w-40 animate-pulse rounded bg-gray-200" />
      </div>
      <SkeletonTable rows={10} cols={8} />
    </main>
  )
}
