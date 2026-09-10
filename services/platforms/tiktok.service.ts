import { prisma } from "@/lib/prisma"
import { encrypt, decrypt } from "@/lib/crypto"
import { exchangeTikTokCode, fetchTikTokProfile, refreshTikTokToken, revokeTikTokToken } from "./tiktok-oauth"
import type { PlatformService, PublishResult } from "./types"

class TikTokService implements PlatformService {
  platform = "TIKTOK" as const

  async getAuthUrl() {
    // The route binds a fresh state nonce to the initiating browser and user.
    return "/api/platforms/tiktok/connect"
  }

  async handleCallback(code: string, userId: string) {
    try {
      const tokens = await exchangeTikTokCode(code)
      const profile = await fetchTikTokProfile(tokens.accessToken)
      if (profile.open_id !== tokens.openId) return { success: false }
      await prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM users WHERE id = ${userId} FOR UPDATE`
        const existing = await tx.platformConnection.findFirst({
          where: { userId, platform: "TIKTOK" }, select: { id: true },
        })
        const data = { accessToken: encrypt(tokens.accessToken), refreshToken: encrypt(tokens.refreshToken),
          expiresAt: tokens.expiresAt, externalAccountName: profile.display_name,
          externalAccountThumbnail: profile.avatar_url ?? null }
        await tx.platformConnection.upsert({
          where: { userId_platform_externalAccountId: { userId, platform: "TIKTOK", externalAccountId: tokens.openId } },
          create: { ...data, userId, platform: "TIKTOK", externalAccountId: tokens.openId, isDefault: !existing },
          update: data,
        })
      })
      return { success: true }
    } catch {
      console.error("[tiktok] Account authorization failed")
      return { success: false }
    }
  }

  async isConnected(userId: string) {
    return Boolean(await prisma.platformConnection.findFirst({
      where: { userId, platform: "TIKTOK" }, select: { id: true },
    }))
  }

  async getConnections(userId: string) {
    const rows = await prisma.platformConnection.findMany({
      where: { userId, platform: "TIKTOK" }, orderBy: { createdAt: "asc" },
      select: { id: true, externalAccountName: true, externalAccountThumbnail: true, isDefault: true },
    })
    return rows.map((row) => ({ id: row.id, name: row.externalAccountName,
      thumbnailUrl: row.externalAccountThumbnail, isDefault: row.isDefault }))
  }

  async setDefaultAccount(userId: string, connectionId: string) {
    return prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM users WHERE id = ${userId} FOR UPDATE`
      const account = await tx.platformConnection.findFirst({ where: { id: connectionId, userId, platform: "TIKTOK" } })
      if (!account) return { success: false }
      await tx.platformConnection.updateMany({ where: { userId, platform: "TIKTOK", isDefault: true }, data: { isDefault: false } })
      await tx.platformConnection.update({ where: { id: connectionId }, data: { isDefault: true } })
      return { success: true }
    })
  }

  async disconnectAccount(userId: string, connectionId: string) {
    const account = await prisma.platformConnection.findFirst({ where: { id: connectionId, userId, platform: "TIKTOK" } })
    if (!account) return { success: false }
    try {
      let token = decrypt(account.accessToken)
      if (account.expiresAt.getTime() <= Date.now() + 60000) {
        const refreshed = await refreshTikTokToken(decrypt(account.refreshToken))
        if (refreshed.openId !== account.externalAccountId) throw new Error("Account mismatch")
        token = refreshed.accessToken
      }
      await revokeTikTokToken(token)
    } catch {
      // Expired/revoked grants must not prevent removing local credentials.
      console.warn("[tiktok] Remote revocation failed; removing local connection")
    }
    return prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM users WHERE id = ${userId} FOR UPDATE`
      await tx.platformConnection.deleteMany({ where: { id: connectionId, userId, platform: "TIKTOK" } })
      const next = await tx.platformConnection.findFirst({ where: { userId, platform: "TIKTOK" }, orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }] })
      if (next) await tx.platformConnection.update({ where: { id: next.id }, data: { isDefault: true } })
      return { success: true }
    })
  }

  async disconnect(userId: string) {
    for (const account of await this.getConnections(userId)) await this.disconnectAccount(userId, account.id)
  }

  async publish(): Promise<PublishResult> {
    return { success: false, error: "TikTok publishing is not available yet. Your account is connected, but Direct Post integration is still required." }
  }
}

export const tiktokService = new TikTokService()
