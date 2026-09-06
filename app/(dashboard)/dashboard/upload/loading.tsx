import { Skeleton } from "@/components/ui/skeleton"

export default function UploadLoading() {
  return (
    <div
      className="mx-auto flex w-full max-w-2xl flex-col gap-6"
      aria-label="Loading upload page"
      aria-busy="true"
    >
      <div className="space-y-2">
        <Skeleton className="h-8 w-44" />
        <Skeleton className="h-4 w-full max-w-md" />
      </div>

      <div className="space-y-5 rounded-xl border p-6">
        <div className="space-y-2">
          <Skeleton className="h-5 w-24" />
          <Skeleton className="h-4 w-64 max-w-full" />
        </div>
        <Skeleton className="h-52 w-full rounded-lg" />
      </div>

      <div className="space-y-5 rounded-xl border p-6">
        <div className="space-y-2">
          <Skeleton className="h-5 w-20" />
          <Skeleton className="h-4 w-80 max-w-full" />
        </div>
        <div className="space-y-2">
          <Skeleton className="h-4 w-12" />
          <Skeleton className="h-9 w-full" />
        </div>
        <div className="space-y-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-24 w-full" />
        </div>
        <Skeleton className="h-9 w-full" />
      </div>
    </div>
  )
}
