"use server"

import { revalidatePath } from "next/cache"
import type { Platform } from "@prisma/client"

import { prisma } from "@/lib/prisma"
import { createClient } from "@/lib/supabase/server"
import { platformServices } from "@/services/platforms"
import {
  platformSettingsSchemaFor,
  isPlatformSettingsComplete,
  type PlatformSettingsInput,
} from "@/lib/validations/platform-settings"
import {
  publishPlatformForUser,
  type PublishPlatformResult,
} from "@/lib/publish-platform"

async function requireUserId() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error("Unauthorized")
  return user.id
}

async function requireOwnedVideo(videoId: string, userId: string) {
  const video = await prisma.video.findUnique({ where: { id: videoId } })
  if (!video || video.userId !== userId) throw new Error("Video not found")
  return video
}

export async function savePlatformSettings(
  videoId: string,
  platform: Platform,
  data: PlatformSettingsInput
) {
  const userId = await requireUserId()
  await requireOwnedVideo(videoId, userId)
  const parsed = platformSettingsSchemaFor(platform).parse(data)

  await prisma.platformSettings.upsert({
    where: { videoId_platform: { videoId, platform } },
    create: {
      videoId,
      platform,
      title: parsed.title,
      caption: parsed.caption || null,
      description: parsed.description || null,
      hashtags: parsed.hashtags,
      containsAltered: parsed.containsAltered,
      privacy: parsed.privacy,
      scheduledAt: parsed.scheduledAt,
    },
    update: {
      title: parsed.title,
      caption: parsed.caption || null,
      description: parsed.description || null,
      hashtags: parsed.hashtags,
      containsAltered: parsed.containsAltered,
      privacy: parsed.privacy,
      scheduledAt: parsed.scheduledAt,
    },
  })
  await prisma.draft.update({
    where: { videoId },
    data: { lastEditedAt: new Date() },
  })
  revalidatePath("/dashboard/drafts")
}

export async function saveVideoDimensions(videoId: string, width: number, height: number) {
  const userId = await requireUserId()
  await requireOwnedVideo(videoId, userId)
  await prisma.video.update({
    where: { id: videoId },
    data: { width, height },
  })
}

export async function startPublishBatch(videoId: string, platforms: Platform[]) {
  const userId = await requireUserId()
  await requireOwnedVideo(videoId, userId)
  await prisma.$transaction([
    prisma.video.update({
      where: { id: videoId },
      data: { status: "PUBLISHING" },
    }),
    prisma.platformSettings.updateMany({
      where: { videoId, platform: { in: platforms } },
      data: { publishStatus: "PENDING", errorMessage: null, publishedAt: null },
    }),
  ])
}

export async function configureBulkPublish(
  videoId: string,
  platforms: Platform[],
  scheduledAtIso: string | null
) {
  const userId = await requireUserId()
  await requireOwnedVideo(videoId, userId)
  const uniquePlatforms = [...new Set(platforms)]
  if (uniquePlatforms.length === 0 || uniquePlatforms.length > 4) {
    throw new Error("Select at least one social platform.")
  }

  const settings = await prisma.platformSettings.findMany({
    where: { videoId, platform: { in: uniquePlatforms } },
  })
  if (
    uniquePlatforms.some(
      (platform) =>
        !isPlatformSettingsComplete(
          platform,
          settings.find((value) => value.platform === platform)
        )
    )
  ) {
    throw new Error("Complete and save the selected platform settings first.")
  }

  const connectedFlags = await Promise.all(
    uniquePlatforms.map((platform) => platformServices[platform].isConnected(userId))
  )
  if (connectedFlags.some((connected) => !connected)) {
    throw new Error("One or more selected social accounts are not connected.")
  }

  const scheduledAt = scheduledAtIso ? new Date(scheduledAtIso) : null
  if (scheduledAt && (!Number.isFinite(scheduledAt.getTime()) || scheduledAt <= new Date())) {
    throw new Error("The scheduled time must be in the future.")
  }

  await prisma.$transaction([
    prisma.video.update({
      where: { id: videoId },
      data: { status: scheduledAt ? "READY" : "PUBLISHING" },
    }),
    prisma.platformSettings.updateMany({
      where: { videoId, platform: { in: uniquePlatforms } },
      data: {
        scheduledAt,
        publishStatus: "PENDING",
        errorMessage: null,
        publishedAt: null,
      },
    }),
    prisma.platformSettings.updateMany({
      where: { videoId, platform: { notIn: uniquePlatforms } },
      data: { scheduledAt: null },
    }),
  ])
  revalidatePath("/dashboard/drafts")
  return { scheduled: scheduledAt !== null }
}

export type { PublishPlatformResult }

export async function publishPlatform(
  videoId: string,
  platform: Platform,
  batchPlatforms: Platform[]
): Promise<PublishPlatformResult> {
  const userId = await requireUserId()
  await requireOwnedVideo(videoId, userId)
  const result = await publishPlatformForUser(
    videoId,
    userId,
    platform,
    batchPlatforms
  )
  revalidatePath("/dashboard/drafts")
  return result
}
