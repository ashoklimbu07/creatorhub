import { prisma } from "@/lib/prisma"
import { deleteFile, listVideoObjects } from "@/lib/storage"

const THRESHOLD_BYTES = 9 * 1000 * 1000 * 1000 // 9 GB

// Cloudflare R2 free tier limit for the bucket, account-wide (not per-user).
export const STORAGE_LIMIT_BYTES = 10 * 1000 * 1000 * 1000 // 10 GB

export function gb(bytes: number): string {
  return (bytes / 1_000_000_000).toFixed(2)
}

// Cheap approximation of bucket-wide usage for display purposes: sums the
// sizeBytes recorded from R2 at finalize time instead of calling R2's List
// API on every page load. Excludes thumbnails (negligible, a few KB each).
export async function getStorageUsageBytes(): Promise<number> {
  const result = await prisma.video.aggregate({ _sum: { sizeBytes: true } })
  return Number(result._sum.sizeBytes ?? BigInt(0))
}

export type QuotaResult = {
  usageBytes: number
  deletedCount: number
  finalUsageBytes: number
}

// Global bucket-wide quota: if total R2 usage exceeds the threshold, deletes
// the oldest videos (DB row + R2 object) until back under it. Not scoped to a
// single user — the R2 free tier limit is account-wide, not per-user.
export async function enforceStorageQuota(): Promise<QuotaResult> {
  const sizeByKey = await listVideoObjects()
  const usageBytes = [...sizeByKey.values()].reduce((sum, size) => sum + size, 0)

  if (usageBytes <= THRESHOLD_BYTES) {
    return { usageBytes, deletedCount: 0, finalUsageBytes: usageBytes }
  }

  const videos = await prisma.video.findMany({
    orderBy: { createdAt: "asc" },
    select: { id: true, title: true, fileUrl: true, thumbnailUrl: true, createdAt: true },
  })

  let remaining = usageBytes
  let deletedCount = 0

  for (const video of videos) {
    if (remaining <= THRESHOLD_BYTES) break

    const objectSize = sizeByKey.get(video.fileUrl) ?? 0

    await prisma.video.delete({ where: { id: video.id } })
    const storedFiles = [
      video.fileUrl,
      ...(video.thumbnailUrl && !/^https?:\/\//i.test(video.thumbnailUrl)
        ? [video.thumbnailUrl]
        : []),
    ]
    const deletionResults = await Promise.allSettled(storedFiles.map(deleteFile))
    if (deletionResults.some((result) => result.status === "rejected")) {
      console.error(`[storage-quota] failed to delete one or more R2 objects for ${video.fileUrl}`)
    }

    remaining -= objectSize
    deletedCount++
  }

  return { usageBytes, deletedCount, finalUsageBytes: remaining }
}
