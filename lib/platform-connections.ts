import type { Platform } from "@prisma/client"

import { prisma } from "@/lib/prisma"
import { facebookService } from "@/services/platforms/facebook.service"
import type { PlatformConnectionInfo } from "@/components/shared/connected-accounts"

export type FacebookPageSummary = {
  id: string
  name: string
  thumbnailUrl: string | null
  isDefault: boolean
}

export type PlatformConnectionsSummary = {
  singleConnections: Partial<Record<Exclude<Platform, "FACEBOOK">, PlatformConnectionInfo>>
  facebook: {
    connections: FacebookPageSummary[]
    default: FacebookPageSummary | null
  }
}

// YouTube/TikTok/Instagram stay single-connection-per-user, so their rows
// collapse 1:1 into a Platform-keyed map. Facebook can have several
// PlatformConnection rows (one per Page) and is summarized separately.
export async function getPlatformConnectionsSummary(userId: string): Promise<PlatformConnectionsSummary> {
  const [otherConnections, facebookConnections] = await Promise.all([
    prisma.platformConnection.findMany({
      where: { userId, platform: { not: "FACEBOOK" } },
      select: { platform: true, externalAccountName: true, externalAccountThumbnail: true },
    }),
    facebookService.getConnections(userId),
  ])

  const singleConnections = Object.fromEntries(
    otherConnections.map((c) => [
      c.platform,
      { name: c.externalAccountName, thumbnailUrl: c.externalAccountThumbnail },
    ])
  ) as Partial<Record<Exclude<Platform, "FACEBOOK">, PlatformConnectionInfo>>

  const facebookPages: FacebookPageSummary[] = facebookConnections.map((c) => ({
    id: c.id,
    name: c.name,
    thumbnailUrl: c.thumbnailUrl,
    isDefault: c.isDefault,
  }))

  return {
    singleConnections,
    facebook: {
      connections: facebookPages,
      default: facebookPages.find((p) => p.isDefault) ?? facebookPages[0] ?? null,
    },
  }
}
