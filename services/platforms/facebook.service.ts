import { prisma } from "@/lib/prisma"
import { encrypt, decrypt } from "@/lib/crypto"
import { signState } from "@/lib/oauth-state"
import {
  buildFacebookAuthorizeUrl,
  exchangeFacebookCode,
  exchangeForLongLivedFacebookUserToken,
  fetchFacebookPages,
  fetchFacebookGrantedPermissions,
  revokeFacebookPermissions,
  uploadFacebookVideo,
  mapFacebookError,
  type FacebookPageInfo,
} from "./meta-oauth"
import type { Platform, PlatformService, PublishInput, PublishResult } from "./types"

function buildDescription(input: PublishInput): string {
  const hashtags = input.hashtags.map((tag) => `#${tag}`).join(" ")
  return [input.title, input.caption, hashtags].filter(Boolean).join("\n\n")
}

export interface FacebookPageConnection {
  id: string
  externalAccountId: string
  name: string
  thumbnailUrl: string | null
  isDefault: boolean
}

class FacebookService implements PlatformService {
  platform: Platform = "FACEBOOK"

  async getAuthUrl(userId: string): Promise<string> {
    return buildFacebookAuthorizeUrl(signState(userId))
  }

  async handleCallback(code: string, userId: string): Promise<{ success: boolean; reason?: string }> {
    try {
      const shortLived = await exchangeFacebookCode(code)
      const userToken = await exchangeForLongLivedFacebookUserToken(shortLived.accessToken)
      const pages = await fetchFacebookPages(userToken.accessToken)

      console.error("[facebook] handleCallback: pages fetched", {
        count: pages.length,
        pages: pages.map((p) => ({ id: p.id, name: p.name })),
      })

      if (pages.length === 0) {
        // Zero pages with no thrown error means the token exchange worked but
        // /me/accounts came back empty. Log the actual granted permissions so
        // this is diagnosable from the server console: a declined
        // pages_show_list points at the Login Configuration, while a granted
        // one points at the Facebook account not being an admin on any Page
        // (or, while the app is in Development Mode, not being added as a
        // Tester/Developer/Admin under the Meta App Dashboard's Roles page).
        const permissions = await fetchFacebookGrantedPermissions(userToken.accessToken).catch(
          (err) => {
            console.error("[facebook] failed to fetch /me/permissions for diagnostics", err)
            return null
          }
        )
        console.error("[facebook] handleCallback failed: zero pages returned from /me/accounts", {
          permissions,
        })
        return { success: false, reason: "NO_PAGES" }
      }

      // Meta's authorization screen is the Page picker. Persist everything it
      // returns so the user does not have to repeat the same selection inside
      // CreatorHub. Reauthorization refreshes tokens without changing the
      // current default Page.
      const existingDefault = await prisma.platformConnection.findFirst({
        where: { userId, platform: "FACEBOOK", isDefault: true },
        select: { externalAccountId: true },
      })

      let firstSavedId: string | null = null
      for (const page of pages) {
        const saved = await this.saveConnection(userId, page, userToken)
        firstSavedId ??= saved.id
      }

      const returnedPageIds = pages.map((page) => page.id)
      await prisma.platformConnection.deleteMany({
        where: {
          userId,
          platform: "FACEBOOK",
          externalAccountId: { notIn: returnedPageIds },
        },
      })

      const defaultIsStillConnected =
        existingDefault && returnedPageIds.includes(existingDefault.externalAccountId)

      if (!defaultIsStillConnected && firstSavedId) {
        await prisma.platformConnection.update({
          where: { id: firstSavedId },
          data: { isDefault: true },
        })
      }

      return { success: true }
    } catch (error) {
      console.error("[facebook] handleCallback failed:", error)
      return { success: false }
    }
  }

  async isConnected(userId: string): Promise<boolean> {
    const connection = await prisma.platformConnection.findFirst({
      where: { userId, platform: "FACEBOOK" },
    })
    return connection !== null
  }

  // Interface-level fallback that disconnects every connected Page — the
  // Connected Accounts UI uses disconnectPage for the normal per-Page flow.
  async disconnect(userId: string): Promise<void> {
    const connections = await prisma.platformConnection.findMany({
      where: { userId, platform: "FACEBOOK" },
    })

    if (connections.length === 0) return

    try {
      await revokeFacebookPermissions(decrypt(connections[0].refreshToken))
    } catch {
      // Best-effort revoke with Meta — still drop our local records either way.
    }

    await prisma.platformConnection.deleteMany({ where: { userId, platform: "FACEBOOK" } })
  }

  async disconnectPage(userId: string, connectionId: string): Promise<{ success: boolean }> {
    const connection = await prisma.platformConnection.findUnique({
      where: { id: connectionId },
    })
    if (!connection || connection.userId !== userId || connection.platform !== "FACEBOOK") {
      return { success: false }
    }

    const connectionCount = await prisma.platformConnection.count({
      where: { userId, platform: "FACEBOOK" },
    })

    if (connectionCount === 1) {
      try {
        await revokeFacebookPermissions(decrypt(connection.refreshToken))
      } catch {
        // Best-effort revoke with Meta — still drop our local record either way.
      }
    }

    await prisma.$transaction(async (tx) => {
      await tx.platformConnection.delete({ where: { id: connectionId } })

      if (connection.isDefault) {
        const next = await tx.platformConnection.findFirst({
          where: { userId, platform: "FACEBOOK" },
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

  async setDefaultPage(userId: string, connectionId: string): Promise<{ success: boolean }> {
    const connection = await prisma.platformConnection.findUnique({
      where: { id: connectionId },
    })
    if (!connection || connection.userId !== userId || connection.platform !== "FACEBOOK") {
      return { success: false }
    }

    await prisma.$transaction([
      prisma.platformConnection.updateMany({
        where: { userId, platform: "FACEBOOK", isDefault: true },
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
          where: { userId: input.userId, platform: "FACEBOOK", isDefault: true },
        })) ??
        (await prisma.platformConnection.findFirst({
          where: { userId: input.userId, platform: "FACEBOOK" },
          orderBy: { createdAt: "asc" },
        }))

      if (!connection) {
        return { success: false, error: "Facebook account isn't connected." }
      }

      // Page tokens derived from a long-lived user token don't expire on
      // their own the way OAuth2 access tokens do, so there's no
      // refresh-before-publish step here (unlike YouTube/Instagram).
      const { videoId } = await uploadFacebookVideo({
        pageId: connection.externalAccountId,
        pageAccessToken: decrypt(connection.accessToken),
        videoUrl: input.videoUrl,
        description: buildDescription(input),
      })

      return { success: true, platformPostId: videoId }
    } catch (error) {
      console.error("[facebook] publish failed:", error)
      return { success: false, error: mapFacebookError(error) }
    }
  }

  // All Pages currently connected for a user, most-recently-added last.
  async getConnections(userId: string): Promise<FacebookPageConnection[]> {
    const connections = await prisma.platformConnection.findMany({
      where: { userId, platform: "FACEBOOK" },
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

  private async saveConnection(
    userId: string,
    page: FacebookPageInfo,
    userToken: { accessToken: string; expiresAt: Date },
    opts?: { isDefault?: boolean }
  ) {
    return prisma.platformConnection.upsert({
      where: {
        userId_platform_externalAccountId: { userId, platform: "FACEBOOK", externalAccountId: page.id },
      },
      create: {
        userId,
        platform: "FACEBOOK",
        isDefault: opts?.isDefault ?? false,
        accessToken: encrypt(page.accessToken),
        refreshToken: encrypt(userToken.accessToken),
        expiresAt: userToken.expiresAt,
        externalAccountId: page.id,
        externalAccountName: page.name,
        externalAccountThumbnail: page.picture,
      },
      update: {
        // isDefault intentionally omitted — re-syncing an existing Page's
        // token on re-authorization must never flip its default status.
        accessToken: encrypt(page.accessToken),
        refreshToken: encrypt(userToken.accessToken),
        expiresAt: userToken.expiresAt,
        externalAccountName: page.name,
        externalAccountThumbnail: page.picture,
      },
    })
  }
}

export const facebookService = new FacebookService()
