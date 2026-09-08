import { NextResponse } from "next/server"
import type { Platform } from "@prisma/client"

import { prisma } from "@/lib/prisma"
import { publishPlatformForUser } from "@/lib/publish-platform"

export const maxDuration = 300

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET is not configured" }, { status: 503 })
  }
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const due = await prisma.platformSettings.findMany({
    where: {
      scheduledAt: { lte: new Date() },
      publishStatus: "PENDING",
      video: { status: "READY" },
    },
    orderBy: { scheduledAt: "asc" },
    take: 40,
    select: {
      id: true,
      videoId: true,
      platform: true,
      video: { select: { userId: true } },
    },
  })

  const claimed: typeof due = []
  for (const item of due) {
    const result = await prisma.platformSettings.updateMany({
      where: { id: item.id, publishStatus: "PENDING" },
      data: { publishStatus: "PUBLISHING", errorMessage: null },
    })
    if (result.count === 1) claimed.push(item)
  }

  const groups = new Map<
    string,
    { userId: string; platforms: Platform[] }
  >()
  for (const item of claimed) {
    const group = groups.get(item.videoId) ?? {
      userId: item.video.userId,
      platforms: [],
    }
    group.platforms.push(item.platform)
    groups.set(item.videoId, group)
  }

  const videoBatches = [...groups.entries()]
  let nextIndex = 0
  const results: Array<{ videoId: string; published: number; total: number }> = []

  async function processNextVideo() {
    while (nextIndex < videoBatches.length) {
      const [videoId, batch] = videoBatches[nextIndex]
      nextIndex += 1
      await prisma.video.update({
        where: { id: videoId },
        data: { status: "PUBLISHING" },
      })
      const settled = await Promise.all(
        batch.platforms.map((platform) =>
          publishPlatformForUser(videoId, batch.userId, platform, batch.platforms).catch(
            async (error) => {
              await prisma.platformSettings.update({
                where: { videoId_platform: { videoId, platform } },
                data: {
                  publishStatus: "FAILED",
                  errorMessage:
                    error instanceof Error ? error.message : "Scheduled publishing failed.",
                },
              })
              return { platform, success: false as const }
            }
          )
        )
      )
      await prisma.video.update({
        where: { id: videoId },
        data: {
          status: settled.some((result) => result.success) ? "PUBLISHED" : "FAILED",
        },
      })
      results.push({
        videoId,
        published: settled.filter((result) => result.success).length,
        total: batch.platforms.length,
      })
    }
  }

  await Promise.all(
    Array.from(
      { length: Math.min(3, videoBatches.length) },
      () => processNextVideo()
    )
  )

  return NextResponse.json({ processedVideos: results.length, results })
}
