import { Skeleton } from "@/components/ui/skeleton"

export function ConnectedAccountsSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: 4 }).map((_, index) => (
        <div key={index} className="flex flex-col items-center gap-3 rounded-xl border px-4 py-5">
          <Skeleton className="size-7 rounded-full" />
          <div className="flex w-full flex-col items-center gap-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-3 w-32" />
          </div>
          <Skeleton className="h-8 w-full" />
        </div>
      ))}
    </div>
  )
}
