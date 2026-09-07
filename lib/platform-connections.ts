import type { Platform } from "@prisma/client"

import { prisma } from "@/lib/prisma"
import { facebookService } from "@/services/platforms/facebook.service"
import { youtubeService } from "@/services/platforms/youtube.service"
import type {
  PlatformConnectionInfo,
  MultiConnectionInfo,
} from "@/components/shared/connected-accounts"

export type MultiPlatformSummary = {
  connections: MultiConnectionInfo[]
  default: MultiConnectionInfo | null
}

export type PlatformConnectionsSummary = {
  singleConnections: Partial<
    Record<Exclude<Platform, "FACEBOOK" | "YOUTUBE">, PlatformConnectionInfo>
  >
  facebook: MultiPlatformSummary
  youtube: MultiPlatformSummary
}

function summarize(connections: MultiConnectionInfo[]): MultiPlatformSummary {
  return {
    connections,
    default: connections.find((c) => c.isDefault) ?? connections[0] ?? null,
  }
}

// TikTok/Instagram stay single-connection-per-user, so their rows collapse
// 1:1 into a Platform-keyed map. Facebook (one row per Page) and YouTube
// (one row per channel — see YouTubeService) can have several
// PlatformConnection rows per user and are summarized separately.
export async function getPlatformConnectionsSummary(
  userId: string
): Promise<PlatformConnectionsSummary> {
  const [otherConnections, facebookConnections, youtubeConnections] = await Promise.all([
    prisma.platformConnection.findMany({
      where: { userId, platform: { notIn: ["FACEBOOK", "YOUTUBE"] } },
      select: { platform: true, externalAccountName: true, externalAccountThumbnail: true },
    }),
    facebookService.getConnections(userId),
    youtubeService.getConnections(userId),
  ])

  const singleConnections = Object.fromEntries(
    otherConnections.map((c) => [
      c.platform,
      { name: c.externalAccountName, thumbnailUrl: c.externalAccountThumbnail },
    ])
  ) as Partial<Record<Exclude<Platform, "FACEBOOK" | "YOUTUBE">, PlatformConnectionInfo>>

  return {
    singleConnections,
    facebook: summarize(facebookConnections),
    youtube: summarize(youtubeConnections),
  }
}
