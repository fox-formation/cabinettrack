import { SkeletonCard, SkeletonTable } from "@/components/ui/Skeleton"

export default function DashboardLoading() {
  return (
    <main className="p-8">
      <div className="mb-6">
        <div className="h-7 w-48 animate-pulse rounded bg-gray-200" />
        <div className="mt-2 h-4 w-64 animate-pulse rounded bg-gray-200" />
      </div>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </div>
      <div className="mt-8 grid gap-8 lg:grid-cols-3">
        <SkeletonTable rows={4} cols={2} />
        <SkeletonTable rows={3} cols={2} />
        <SkeletonTable rows={5} cols={2} />
      </div>
    </main>
  )
}
