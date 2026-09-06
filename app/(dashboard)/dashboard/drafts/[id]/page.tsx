import { notFound, redirect } from "next/navigation"
import type { Platform, PlatformSettings } from "@prisma/client"

import { getCurrentUser } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getSignedVideoUrl } from "@/lib/storage"
import { formatFileSize } from "@/lib/utils"
import { platformServices } from "@/services/platforms"
import { VideoStatusBadge } from "@/components/shared/video-status-badge"
import { DeleteDraftButton } from "@/components/shared/delete-draft-button"
import { VideoWorkspace } from "@/components/shared/video-workspace"
import { PublishPanel } from "@/components/shared/publish-panel"

const ALL_PLATFORMS: Platform[] = ["YOUTUBE", "TIKTOK", "INSTAGRAM", "FACEBOOK"]

export default async function DraftDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  const user = await getCurrentUser()

  if (!user) {
    redirect("/login")
  }

  const [draft, connectedFlags] = await Promise.all([
    prisma.draft.findUnique({
      where: { id },
      include: { video: { include: { platformSettings: true } } },
    }),
    Promise.all(
      ALL_PLATFORMS.map((platform) => platformServices[platform].isConnected(user.id))
    ),
  ])

  if (!draft || draft.video.userId !== user.id) {
    notFound()
  }

  const connectedPlatforms = ALL_PLATFORMS.filter((_, i) => connectedFlags[i])

  const { video } = draft
  const videoUrl = await getSignedVideoUrl(video.fileUrl)

  const settingsByPlatform = ALL_PLATFORMS.reduce(
    (acc, platform) => {
      acc[platform] =
        video.platformSettings.find((s) => s.platform === platform) ?? null
      return acc
    },
    {} as Record<Platform, PlatformSettings | null>
  )

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-semibold">{video.title}</h1>
          <div className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
            <VideoStatusBadge status={video.status} />
            <span>
              Last edited {new Date(draft.lastEditedAt).toLocaleDateString()}
            </span>
            {video.sizeBytes != null && (
              <span>{formatFileSize(video.sizeBytes)}</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <PublishPanel
            videoId={video.id}
            settingsByPlatform={settingsByPlatform}
            connectedPlatforms={connectedPlatforms}
          />
          <DeleteDraftButton videoId={video.id} redirectTo="/dashboard/drafts" />
        </div>
      </div>

      <VideoWorkspace
        videoId={video.id}
        videoUrl={videoUrl}
        settingsByPlatform={settingsByPlatform}
        initialDimensions={
          video.width && video.height
            ? { width: video.width, height: video.height }
            : null
        }
      />
    </div>
  )
}
