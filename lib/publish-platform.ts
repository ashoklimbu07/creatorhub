import type { Platform } from "@prisma/client"

import { prisma } from "@/lib/prisma"
import { getSignedVideoUrl } from "@/lib/storage"
import { platformServices } from "@/services/platforms"
import {
  isPlatformSettingsComplete,
  PLATFORMS_WITH_DESCRIPTION,
} from "@/lib/validations/platform-settings"

export type PublishPlatformResult = {
  platform: Platform
  success: boolean
  error?: string
  platformPostId?: string
}

export async function publishPlatformForUser(
  videoId: string,
  userId: string,
  platform: Platform,
  batchPlatforms: Platform[]
): Promise<PublishPlatformResult> {
  const video = await prisma.video.findFirst({ where: { id: videoId, userId } })
  if (!video) throw new Error("Video not found")

  const settings = await prisma.platformSettings.findUnique({
    where: { videoId_platform: { videoId, platform } },
  })
  if (!isPlatformSettingsComplete(platform, settings)) {
    const contentLabel = PLATFORMS_WITH_DESCRIPTION.includes(platform)
      ? "description"
      : "caption"
    return {
      platform,
      success: false,
      error: `This platform's tab isn't complete — add a title and ${contentLabel} first.`,
    }
  }

  await prisma.platformSettings.update({
    where: { videoId_platform: { videoId, platform } },
    data: { publishStatus: "PUBLISHING" },
  })

  const service = platformServices[platform]
  const connected = await service.isConnected(userId)
  const result = connected
    ? await service.publish({
        userId,
        videoUrl: await getSignedVideoUrl(video.fileUrl),
        title: settings.title,
        caption: settings.caption ?? "",
        description: settings.description ?? undefined,
        hashtags: settings.hashtags,
        containsAltered: settings.containsAltered,
        privacy: settings.privacy,
        scheduledAt: settings.scheduledAt ?? undefined,
      })
    : {
        success: false,
        error: `${platform} account isn't connected — connect it from the Accounts page first.`,
      }

  await prisma.platformSettings.update({
    where: { videoId_platform: { videoId, platform } },
    data: {
      publishStatus: result.success ? "SUCCESS" : "FAILED",
      publishedAt: result.success ? new Date() : null,
      errorMessage: result.success ? null : (result.error ?? "Unknown error"),
    },
  })

  const batchRows = await prisma.platformSettings.findMany({
    where: { videoId, platform: { in: batchPlatforms } },
    select: { publishStatus: true },
  })
  if (
    batchRows.every(
      (row) => row.publishStatus === "SUCCESS" || row.publishStatus === "FAILED"
    )
  ) {
    const anySuccess = batchRows.some((row) => row.publishStatus === "SUCCESS")
    await prisma.video.update({
      where: { id: videoId },
      data: { status: anySuccess ? "PUBLISHED" : "FAILED" },
    })
  }

  return {
    platform,
    success: result.success,
    error: result.error,
    platformPostId: "platformPostId" in result ? result.platformPostId : undefined,
  }
}
