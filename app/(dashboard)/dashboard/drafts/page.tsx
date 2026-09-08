import Link from "next/link"
import { redirect } from "next/navigation"
import { FileVideo } from "lucide-react"
import type { Platform } from "@prisma/client"

import { getCurrentUser } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getSignedAssetUrl, getSignedVideoUrl } from "@/lib/storage"
import { formatFileSize } from "@/lib/utils"
import { isPlatformSettingsComplete } from "@/lib/validations/platform-settings"
import { platformServices } from "@/services/platforms"
import { Button } from "@/components/ui/button"
import {
  BulkPublishDrafts,
  type PublishableDraft,
} from "@/components/shared/bulk-publish-drafts"

const ALL_PLATFORMS: Platform[] = ["YOUTUBE", "TIKTOK", "INSTAGRAM", "FACEBOOK"]

export default async function DraftsPage() {
  const user = await getCurrentUser()

  if (!user) {
    redirect("/login")
  }

  const [drafts, connectedFlags] = await Promise.all([
    prisma.draft.findMany({
      where: { video: { userId: user.id } },
      orderBy: { lastEditedAt: "desc" },
      include: { video: { include: { platformSettings: true } } },
    }),
    Promise.all(
      ALL_PLATFORMS.map((platform) => platformServices[platform].isConnected(user.id))
    ),
  ])
  const connectedPlatforms = ALL_PLATFORMS.filter((_, index) => connectedFlags[index])

  const draftsWithPreviews = await Promise.all(
    drafts.map(async (draft): Promise<PublishableDraft> => {
      const completePlatforms = ALL_PLATFORMS.filter((platform) =>
        isPlatformSettingsComplete(
          platform,
          draft.video.platformSettings.find((settings) => settings.platform === platform)
        )
      )
      const nextScheduledAt = draft.video.platformSettings
        .map((settings) => settings.scheduledAt)
        .filter((value): value is Date => value !== null && value > new Date())
        .sort((a, b) => a.getTime() - b.getTime())[0]
      return {
        id: draft.id,
        videoId: draft.video.id,
        title: draft.video.title,
        status: draft.video.status,
        lastEditedLabel: new Date(draft.lastEditedAt).toLocaleDateString(),
        sizeLabel: draft.video.sizeBytes != null ? formatFileSize(draft.video.sizeBytes) : null,
        previewUrl: draft.video.thumbnailUrl
          ? await getSignedAssetUrl(draft.video.thumbnailUrl)
          : `${await getSignedVideoUrl(draft.video.fileUrl)}#t=0.1`,
        previewType: draft.video.thumbnailUrl ? "image" : "video",
        completePlatforms,
        readyPlatforms: completePlatforms.filter((platform) =>
          connectedPlatforms.includes(platform)
        ),
        scheduledLabel: nextScheduledAt?.toLocaleString() ?? null,
      }
    })
  )

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Drafts</h1>
        <p className="text-muted-foreground">
          Videos you&apos;ve uploaded but haven&apos;t published yet.
        </p>
      </div>

      {draftsWithPreviews.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border py-16 text-center">
          <FileVideo className="size-8 text-muted-foreground" />
          <p className="text-sm font-medium">No drafts yet</p>
          <p className="text-sm text-muted-foreground">
            Upload a video to start a new draft.
          </p>
          <Button asChild className="mt-2">
            <Link href="/dashboard/upload">Upload video</Link>
          </Button>
        </div>
      ) : (
        <BulkPublishDrafts drafts={draftsWithPreviews} />
      )}
    </div>
  )
}
