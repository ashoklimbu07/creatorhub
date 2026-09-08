import type { PlatformConnection } from "@prisma/client"

import { prisma } from "@/lib/prisma"
import { encrypt, decrypt } from "@/lib/crypto"
import { signState } from "@/lib/oauth-state"
import {
  buildInstagramAuthorizeUrl,
  exchangeInstagramCode,
  exchangeForLongLivedInstagramToken,
  refreshLongLivedInstagramToken,
  fetchInstagramProfile,
  createInstagramContainer,
  waitForInstagramContainer,
  publishInstagramContainer,
  mapInstagramError,
} from "./meta-oauth"
import type { Platform, PlatformService, PublishInput, PublishResult } from "./types"

function buildCaption(input: PublishInput): string {
  const hashtags = input.hashtags.map((tag) => `#${tag}`).join(" ")
  return [input.caption, hashtags].filter(Boolean).join("\n\n")
}

export interface InstagramAccountConnection {
  id: string
  externalAccountId: string
  name: string
  thumbnailUrl: string | null
  isDefault: boolean
}

// Instagram Business Login hands back exactly one Instagram professional
// account per OAuth grant (unlike Facebook's Page picker, which can return
// several Pages from a single consent) — a user connects several Instagram
// accounts by repeating the OAuth flow, mirroring YouTubeService's
// one-row-per-channel pattern rather than FacebookService's batch upsert.
class InstagramService implements PlatformService {
  platform: Platform = "INSTAGRAM"

  async getAuthUrl(userId: string): Promise<string> {
    return buildInstagramAuthorizeUrl(signState(userId))
  }

  async handleCallback(code: string, userId: string): Promise<{ success: boolean }> {
    try {
      const shortLived = await exchangeInstagramCode(code)
      const longLived = await exchangeForLongLivedInstagramToken(shortLived.accessToken)
      const profile = await fetchInstagramProfile(longLived.accessToken)

      const hasAnyAccount = await prisma.platformConnection.findFirst({
        where: { userId, platform: "INSTAGRAM" },
        select: { id: true },
      })

      await prisma.platformConnection.upsert({
        where: {
          userId_platform_externalAccountId: {
            userId,
            platform: "INSTAGRAM",
            externalAccountId: shortLived.igUserId,
          },
        },
        create: {
          userId,
          platform: "INSTAGRAM",
          // First account this user connects becomes the default publish
          // target; re-authorizing an already-connected account must never
          // flip default status (matches YouTubeService.handleCallback).
          isDefault: !hasAnyAccount,
          accessToken: encrypt(longLived.accessToken),
          // Instagram's long-lived token refreshes itself via
          // ig_refresh_token — there's no separate refresh credential, so we
          // duplicate the access token here to satisfy the shared
          // PlatformConnection schema (see getValidAccessToken below).
          refreshToken: encrypt(longLived.accessToken),
          expiresAt: longLived.expiresAt,
          externalAccountId: shortLived.igUserId,
          externalAccountName: profile.username,
          externalAccountThumbnail: profile.profilePictureUrl,
        },
        update: {
          accessToken: encrypt(longLived.accessToken),
          refreshToken: encrypt(longLived.accessToken),
          expiresAt: longLived.expiresAt,
          externalAccountName: profile.username,
          externalAccountThumbnail: profile.profilePictureUrl,
        },
      })

      return { success: true }
    } catch (error) {
      console.error("[instagram] handleCallback failed:", error)
      return { success: false }
    }
  }

  async isConnected(userId: string): Promise<boolean> {
    const connection = await prisma.platformConnection.findFirst({
      where: { userId, platform: "INSTAGRAM" },
    })
    return connection !== null
  }

  // Interface-level fallback that disconnects every connected account — the
  // Connected Accounts UI uses disconnectAccount for the normal per-account
  // flow.
  async disconnect(userId: string): Promise<void> {
    // Instagram API with Instagram Login has no documented public
    // token-revocation endpoint — the user revokes access from the
    // Instagram app (Settings > Apps and Websites). We just drop our copy.
    await prisma.platformConnection.deleteMany({
      where: { userId, platform: "INSTAGRAM" },
    })
  }

  async disconnectAccount(userId: string, connectionId: string): Promise<{ success: boolean }> {
    const connection = await prisma.platformConnection.findUnique({
      where: { id: connectionId },
    })
    if (!connection || connection.userId !== userId || connection.platform !== "INSTAGRAM") {
      return { success: false }
    }

    await prisma.$transaction(async (tx) => {
      await tx.platformConnection.delete({ where: { id: connectionId } })

      if (connection.isDefault) {
        const next = await tx.platformConnection.findFirst({
          where: { userId, platform: "INSTAGRAM" },
          orderBy: { createdAt: "asc" },
        })
        if (next) {
          await tx.platformConnection.update({
            where: { id: next.id },
            data: { isDefault: true },
          })
        }
      }
    })

    return { success: true }
  }

  async setDefaultAccount(userId: string, connectionId: string): Promise<{ success: boolean }> {
    const connection = await prisma.platformConnection.findUnique({
      where: { id: connectionId },
    })
    if (!connection || connection.userId !== userId || connection.platform !== "INSTAGRAM") {
      return { success: false }
    }

    await prisma.$transaction([
      prisma.platformConnection.updateMany({
        where: { userId, platform: "INSTAGRAM", isDefault: true },
        data: { isDefault: false },
      }),
      prisma.platformConnection.update({
        where: { id: connectionId },
        data: { isDefault: true },
      }),
    ])

    return { success: true }
  }

  async publish(input: PublishInput): Promise<PublishResult> {
    try {
      const connection =
        (await prisma.platformConnection.findFirst({
          where: { userId: input.userId, platform: "INSTAGRAM", isDefault: true },
        })) ??
        (await prisma.platformConnection.findFirst({
          where: { userId: input.userId, platform: "INSTAGRAM" },
          orderBy: { createdAt: "asc" },
        }))

      if (!connection) {
        return { success: false, error: "Instagram account isn't connected." }
      }

      const accessToken = await this.getValidAccessToken(connection)

      const { containerId } = await createInstagramContainer({
        accessToken,
        igUserId: connection.externalAccountId,
        videoUrl: input.videoUrl,
        caption: buildCaption(input),
      })

      await waitForInstagramContainer({ accessToken, containerId })

      const { mediaId } = await publishInstagramContainer({
        accessToken,
        igUserId: connection.externalAccountId,
        containerId,
      })

      return { success: true, platformPostId: mediaId }
    } catch (error) {
      return { success: false, error: mapInstagramError(error) }
    }
  }

  // All accounts currently connected for a user, oldest first.
  async getConnections(userId: string): Promise<InstagramAccountConnection[]> {
    const connections = await prisma.platformConnection.findMany({
      where: { userId, platform: "INSTAGRAM" },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        externalAccountId: true,
        externalAccountName: true,
        externalAccountThumbnail: true,
        isDefault: true,
      },
    })

    return connections.map((c) => ({
      id: c.id,
      externalAccountId: c.externalAccountId,
      name: c.externalAccountName,
      thumbnailUrl: c.externalAccountThumbnail,
      isDefault: c.isDefault,
    }))
  }

  private async getValidAccessToken(connection: PlatformConnection): Promise<string> {
    // Long-lived tokens last ~60 days; refresh with a wide buffer since this
    // only runs opportunistically at publish time (see also
    // scripts/refresh-instagram-tokens.ts for accounts that go quiet).
    const EXPIRY_BUFFER_MS = 7 * 24 * 60 * 60 * 1000
    if (connection.expiresAt.getTime() > Date.now() + EXPIRY_BUFFER_MS) {
      return decrypt(connection.accessToken)
    }

    const refreshed = await refreshLongLivedInstagramToken(decrypt(connection.accessToken))
    await prisma.platformConnection.update({
      where: { id: connection.id },
      data: {
        accessToken: encrypt(refreshed.accessToken),
        refreshToken: encrypt(refreshed.accessToken),
        expiresAt: refreshed.expiresAt,
      },
    })
    return refreshed.accessToken
  }
}

export const instagramService = new InstagramService()
