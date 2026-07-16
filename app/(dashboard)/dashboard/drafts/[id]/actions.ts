"use server"

import { revalidatePath } from "next/cache"
import type { Platform } from "@prisma/client"

import { prisma } from "@/lib/prisma"
import { createClient } from "@/lib/supabase/server"
import { getSignedVideoUrl } from "@/lib/storage"
import { platformServices } from "@/services/platforms"
import {
  platformSettingsSchema,
  type PlatformSettingsInput,
} from "@/lib/validations/platform-settings"

async function requireUserId() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error("Unauthorized")
  }

  return user.id
}

async function requireOwnedVideo(videoId: string, userId: string) {
  const video = await prisma.video.findUnique({ where: { id: videoId } })

  if (!video || video.userId !== userId) {
    throw new Error("Video not found")
  }

  return video
}

export async function savePlatformSettings(
  videoId: string,
  platform: Platform,
  data: PlatformSettingsInput
) {
  const userId = await requireUserId()
  await requireOwnedVideo(videoId, userId)

  const parsed = platformSettingsSchema.parse(data)

  await prisma.platformSettings.upsert({
    where: { videoId_platform: { videoId, platform } },
    create: {
      videoId,
      platform,
      title: parsed.title,
      caption: parsed.caption || null,
      description: parsed.description || null,
      hashtags: parsed.hashtags,
      privacy: parsed.privacy,
      scheduledAt: parsed.scheduledAt,
    },
    update: {
      title: parsed.title,
      caption: parsed.caption || null,
      description: parsed.description || null,
      hashtags: parsed.hashtags,
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

export type PublishPlatformResult = {
  platform: Platform
  success: boolean
  error?: string
  platformPostId?: string
}

// Publishes a single platform, then — if this was the last platform in the
// batch to resolve — rolls the parent Video.status up to PUBLISHED (partial
// success still counts) or FAILED (every platform in the batch failed).
export async function publishPlatform(
  videoId: string,
  platform: Platform,
  batchPlatforms: Platform[]
): Promise<PublishPlatformResult> {
  const userId = await requireUserId()
  const video = await requireOwnedVideo(videoId, userId)

  const settings = await prisma.platformSettings.findUnique({
    where: { videoId_platform: { videoId, platform } },
  })

  if (!settings || !settings.title.trim() || !settings.caption?.trim()) {
    return {
      platform,
      success: false,
      error: "This platform's tab isn't complete — add a title and caption first.",
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
        videoUrl: await getSignedVideoUrl(video.fileUrl),
        title: settings.title,
        caption: settings.caption ?? "",
        description: settings.description ?? undefined,
        hashtags: settings.hashtags,
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

  const allResolved = batchRows.every(
    (row) => row.publishStatus === "SUCCESS" || row.publishStatus === "FAILED"
  )

  if (allResolved) {
    const anySuccess = batchRows.some((row) => row.publishStatus === "SUCCESS")
    await prisma.video.update({
      where: { id: videoId },
      data: { status: anySuccess ? "PUBLISHED" : "FAILED" },
    })
  }

  revalidatePath("/dashboard/drafts")

  return {
    platform,
    success: result.success,
    error: result.error,
    platformPostId: "platformPostId" in result ? result.platformPostId : undefined,
  }
}
