import type { PlatformConnection } from "@prisma/client"

import { prisma } from "@/lib/prisma"
import { encrypt, decrypt } from "@/lib/crypto"
import { signState } from "@/lib/oauth-state"
import {
  buildAuthorizeUrl,
  exchangeCodeForTokens,
  refreshAccessToken,
  revokeToken,
  fetchOwnChannel,
  uploadVideo,
  GoogleApiError,
} from "./google-oauth"
import type { Platform, PlatformService, PublishInput, PublishResult } from "./types"

const PRIVACY_MAP: Record<PublishInput["privacy"], "public" | "unlisted" | "private"> = {
  PUBLIC: "public",
  UNLISTED: "unlisted",
  PRIVATE: "private",
}

function mapGoogleError(error: unknown): string {
  if (error instanceof GoogleApiError) {
    if (error.status === 401 || /invalid_grant/i.test(error.body)) {
      return "YouTube access expired or was revoked — reconnect your account."
    }
    if (error.status === 403 && /quotaExceeded/i.test(error.body)) {
      return "YouTube daily upload quota exceeded — try again tomorrow."
    }
    if (error.status === 403) {
      return "YouTube rejected this upload — check your account's permissions."
    }
    if (error.status === 413) {
      return "Video file is too large for YouTube."
    }
    if (error.status === 400 && /unsupported|invalid.*format/i.test(error.body)) {
      return "Video format isn't supported by YouTube."
    }
    return `YouTube upload failed (HTTP ${error.status}).`
  }
  if (error instanceof Error) return error.message
  return "Unknown error while publishing to YouTube."
}

export interface YouTubeChannelConnection {
  id: string
  externalAccountId: string
  name: string
  thumbnailUrl: string | null
  isDefault: boolean
}

// YouTube Data API v3 default daily quota is 10,000 units per project.
// videos.insert costs ~1600 units, so roughly 6 uploads/day before hitting a
// quotaExceeded (403) error — see mapGoogleError above for how that surfaces.
// A user can connect several channels (each a separate Google account/OAuth
// grant — Google doesn't hand back multiple channels from one consent the
// way Meta hands back multiple Pages), mirroring FacebookService's
// one-row-per-Page pattern with one-row-per-channel instead.
class YouTubeService implements PlatformService {
  platform: Platform = "YOUTUBE"

  async getAuthUrl(userId: string): Promise<string> {
    return buildAuthorizeUrl(signState(userId))
  }

  async handleCallback(code: string, userId: string): Promise<{ success: boolean }> {
    try {
      const tokens = await exchangeCodeForTokens(code)
      const channel = await fetchOwnChannel(tokens.accessToken)

      const existing = await prisma.platformConnection.findUnique({
        where: {
          userId_platform_externalAccountId: {
            userId,
            platform: "YOUTUBE",
            externalAccountId: channel.id,
          },
        },
      })

      // Google only issues a refresh_token on the first consent for a given
      // user+client+account. Without one on file for this specific channel,
      // we can't refresh later.
      if (!tokens.refreshToken && !existing) {
        return { success: false }
      }

      const hasAnyChannel = await prisma.platformConnection.findFirst({
        where: { userId, platform: "YOUTUBE" },
        select: { id: true },
      })

      await prisma.platformConnection.upsert({
        where: {
          userId_platform_externalAccountId: {
            userId,
            platform: "YOUTUBE",
            externalAccountId: channel.id,
          },
        },
        create: {
          userId,
          platform: "YOUTUBE",
          // First channel this user connects becomes the default publish
          // target; re-authorizing an already-connected channel must never
          // flip default status (matches FacebookService.saveConnection).
          isDefault: !hasAnyChannel,
          accessToken: encrypt(tokens.accessToken),
          refreshToken: encrypt(tokens.refreshToken!),
          expiresAt: tokens.expiresAt,
          externalAccountId: channel.id,
          externalAccountName: channel.title,
          externalAccountThumbnail: channel.thumbnailUrl,
        },
        update: {
          accessToken: encrypt(tokens.accessToken),
          ...(tokens.refreshToken ? { refreshToken: encrypt(tokens.refreshToken) } : {}),
          expiresAt: tokens.expiresAt,
          externalAccountName: channel.title,
          externalAccountThumbnail: channel.thumbnailUrl,
        },
      })

      return { success: true }
    } catch (error) {
      console.error("[youtube] handleCallback failed:", error)
      return { success: false }
    }
  }

  async isConnected(userId: string): Promise<boolean> {
    const connection = await prisma.platformConnection.findFirst({
      where: { userId, platform: "YOUTUBE" },
    })
    return connection !== null
  }

  // Interface-level fallback that disconnects every connected channel — the
  // Connected Accounts UI uses disconnectChannel for the normal per-channel
  // flow. Each channel is a separate Google OAuth grant, so revoking one
  // never affects the others (unlike Facebook's shared user token).
  async disconnect(userId: string): Promise<void> {
    const connections = await prisma.platformConnection.findMany({
      where: { userId, platform: "YOUTUBE" },
    })

    await Promise.all(
      connections.map((connection) =>
        revokeToken(decrypt(connection.refreshToken)).catch(() => {
          // Best-effort revoke with Google — still drop our local record either way.
        })
      )
    )

    await prisma.platformConnection.deleteMany({ where: { userId, platform: "YOUTUBE" } })
  }

  async disconnectChannel(userId: string, connectionId: string): Promise<{ success: boolean }> {
    const connection = await prisma.platformConnection.findUnique({
      where: { id: connectionId },
    })
    if (!connection || connection.userId !== userId || connection.platform !== "YOUTUBE") {
      return { success: false }
    }

    try {
      await revokeToken(decrypt(connection.refreshToken))
    } catch {
      // Best-effort revoke with Google — still drop our local record either way.
    }

    await prisma.$transaction(async (tx) => {
      await tx.platformConnection.delete({ where: { id: connectionId } })

      if (connection.isDefault) {
        const next = await tx.platformConnection.findFirst({
          where: { userId, platform: "YOUTUBE" },
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

  async setDefaultChannel(userId: string, connectionId: string): Promise<{ success: boolean }> {
    const connection = await prisma.platformConnection.findUnique({
      where: { id: connectionId },
    })
    if (!connection || connection.userId !== userId || connection.platform !== "YOUTUBE") {
      return { success: false }
    }

    await prisma.$transaction([
      prisma.platformConnection.updateMany({
        where: { userId, platform: "YOUTUBE", isDefault: true },
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
          where: { userId: input.userId, platform: "YOUTUBE", isDefault: true },
        })) ??
        (await prisma.platformConnection.findFirst({
          where: { userId: input.userId, platform: "YOUTUBE" },
          orderBy: { createdAt: "asc" },
        }))

      if (!connection) {
        return { success: false, error: "YouTube account isn't connected." }
      }

      const accessToken = await this.getValidAccessToken(connection)

      const { videoId } = await uploadVideo({
        accessToken,
        videoUrl: input.videoUrl,
        title: input.title,
        description: input.description || input.caption,
        tags: input.hashtags,
        privacyStatus: PRIVACY_MAP[input.privacy],
        containsSyntheticMedia: input.containsAltered,
      })

      return { success: true, platformPostId: videoId }
    } catch (error) {
      return { success: false, error: mapGoogleError(error) }
    }
  }

  // All channels currently connected for a user, oldest first.
  async getConnections(userId: string): Promise<YouTubeChannelConnection[]> {
    const connections = await prisma.platformConnection.findMany({
      where: { userId, platform: "YOUTUBE" },
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
    const EXPIRY_BUFFER_MS = 60_000
    if (connection.expiresAt.getTime() > Date.now() + EXPIRY_BUFFER_MS) {
      return decrypt(connection.accessToken)
    }

    const refreshed = await refreshAccessToken(decrypt(connection.refreshToken))
    await prisma.platformConnection.update({
      where: { id: connection.id },
      data: {
        accessToken: encrypt(refreshed.accessToken),
        expiresAt: refreshed.expiresAt,
      },
    })
    return refreshed.accessToken
  }
}

export const youtubeService = new YouTubeService()
