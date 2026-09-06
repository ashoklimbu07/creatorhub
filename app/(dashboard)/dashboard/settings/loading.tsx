import { Skeleton } from "@/components/ui/skeleton"

export default function SettingsLoading() {
  return (
    <div
      className="mx-auto flex w-full max-w-2xl flex-col gap-6"
      aria-label="Loading settings"
      aria-busy="true"
    >
      <div className="space-y-2">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-4 w-64 max-w-full" />
      </div>
      <div className="space-y-5 rounded-xl border p-6">
        <div className="space-y-2">
          <Skeleton className="h-5 w-20" />
          <Skeleton className="h-4 w-56 max-w-full" />
        </div>
        <div className="space-y-2">
          <Skeleton className="h-4 w-12" />
          <Skeleton className="h-5 w-48 max-w-full" />
        </div>
      </div>
    </div>
  )
}
