import { Progress } from "@/components/ui/progress"
import { getStorageUsageBytes, gb, STORAGE_LIMIT_BYTES } from "@/lib/storage-quota"
import { cn } from "@/lib/utils"

export async function StorageUsage() {
  const usageBytes = await getStorageUsageBytes()
  const percent = Math.min(100, (usageBytes / STORAGE_LIMIT_BYTES) * 100)
  const isNearLimit = percent >= 90

  return (
    <div className="hidden items-center gap-2 sm:flex" title="Cloud storage used">
      <Progress
        value={percent}
        className={cn("h-1.5 w-20", isNearLimit && "[&_[data-slot=progress-indicator]]:bg-destructive")}
      />
      <span className={cn("text-xs text-muted-foreground", isNearLimit && "text-destructive")}>
        {gb(usageBytes)} / 10 GB
      </span>
    </div>
  )
}
