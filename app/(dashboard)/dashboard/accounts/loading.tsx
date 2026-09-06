import { ConnectedAccountsSkeleton } from "@/components/shared/connected-accounts-skeleton"
import { Skeleton } from "@/components/ui/skeleton"

export default function AccountsLoading() {
  return (
    <div className="flex flex-col gap-6" aria-label="Loading connected accounts" aria-busy="true">
      <div className="space-y-2">
        <Skeleton className="h-8 w-64 max-w-full" />
        <Skeleton className="h-4 w-80 max-w-full" />
      </div>
      <ConnectedAccountsSkeleton />
    </div>
  )
}
