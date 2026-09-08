import type { Platform } from "@prisma/client"

import { prisma } from "@/lib/prisma"
import { facebookService } from "@/services/platforms/facebook.service"
import { youtubeService } from "@/services/platforms/youtube.service"
import { instagramService } from "@/services/platforms/instagram.service"
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
    Record<Exclude<Platform, "FACEBOOK" | "YOUTUBE" | "INSTAGRAM">, PlatformConnectionInfo>
  >
  facebook: MultiPlatformSummary
  youtube: MultiPlatformSummary
  instagram: MultiPlatformSummary
}

function summarize(connections: MultiConnectionInfo[]): MultiPlatformSummary {
  return {
    connections,
    default: connections.find((c) => c.isDefault) ?? connections[0] ?? null,
  }
}

// TikTok stays single-connection-per-user, so its rows collapse 1:1 into a
// Platform-keyed map. Facebook (one row per Page), YouTube (one row per
// channel), and Instagram (one row per account — see InstagramService) can
// have several PlatformConnection rows per user and are summarized
// separately.
export async function getPlatformConnectionsSummary(
  userId: string
): Promise<PlatformConnectionsSummary> {
  const [otherConnections, facebookConnections, youtubeConnections, instagramConnections] =
    await Promise.all([
      prisma.platformConnection.findMany({
        where: { userId, platform: { notIn: ["FACEBOOK", "YOUTUBE", "INSTAGRAM"] } },
        select: { platform: true, externalAccountName: true, externalAccountThumbnail: true },
      }),
      facebookService.getConnections(userId),
      youtubeService.getConnections(userId),
      instagramService.getConnections(userId),
    ])

  const singleConnections = Object.fromEntries(
    otherConnections.map((c) => [
      c.platform,
      { name: c.externalAccountName, thumbnailUrl: c.externalAccountThumbnail },
    ])
  ) as Partial<Record<Exclude<Platform, "FACEBOOK" | "YOUTUBE" | "INSTAGRAM">, PlatformConnectionInfo>>

  return {
    singleConnections,
    facebook: summarize(facebookConnections),
    youtube: summarize(youtubeConnections),
    instagram: summarize(instagramConnections),
  }
}
