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

// YouTube Data API v3 default daily quota is 10,000 units per project.
// videos.insert costs ~1600 units, so roughly 6 uploads/day before hitting a
// quotaExceeded (403) error — see mapGoogleError above for how that surfaces.
class YouTubeService implements PlatformService {
  platform: Platform = "YOUTUBE"

  async getAuthUrl(userId: string): Promise<string> {
    return buildAuthorizeUrl(signState(userId))
  }

  async handleCallback(code: string, userId: string): Promise<{ success: boolean }> {
    try {
      const tokens = await exchangeCodeForTokens(code)

      const existing = await prisma.platformConnection.findFirst({
        where: { userId, platform: "YOUTUBE" },
      })

      // Google only issues a refresh_token on the first consent for a given
      // user+client. Without an existing one on file, we can't refresh later.
      if (!tokens.refreshToken && !existing) {
        return { success: false }
      }

      const channel = await fetchOwnChannel(tokens.accessToken)

      if (existing) {
        await prisma.platformConnection.update({
          where: { id: existing.id },
          data: {
            accessToken: encrypt(tokens.accessToken),
            ...(tokens.refreshToken ? { refreshToken: encrypt(tokens.refreshToken) } : {}),
            expiresAt: tokens.expiresAt,
            externalAccountId: channel.id,
            externalAccountName: channel.title,
            externalAccountThumbnail: channel.thumbnailUrl,
          },
        })
      } else {
        await prisma.platformConnection.create({
          data: {
            userId,
            platform: "YOUTUBE",
            isDefault: true,
            accessToken: encrypt(tokens.accessToken),
            refreshToken: encrypt(tokens.refreshToken!),
            expiresAt: tokens.expiresAt,
            externalAccountId: channel.id,
            externalAccountName: channel.title,
            externalAccountThumbnail: channel.thumbnailUrl,
          },
        })
      }

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

  async disconnect(userId: string): Promise<void> {
    const connection = await prisma.platformConnection.findFirst({
      where: { userId, platform: "YOUTUBE" },
    })
    if (!connection) return

    try {
      await revokeToken(decrypt(connection.refreshToken))
    } catch {
      // Best-effort revoke with Google — still drop our local record either way.
    }

    await prisma.platformConnection.delete({ where: { id: connection.id } })
  }

  async publish(input: PublishInput): Promise<PublishResult> {
    try {
      const connection = await prisma.platformConnection.findFirst({
        where: { userId: input.userId, platform: "YOUTUBE" },
      })

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
