import { prisma } from "@/lib/prisma"

import type { Platform, PlatformService, PublishResult } from "./types"

const MIN_LATENCY_MS = 1500
const MAX_LATENCY_MS = 4000
const SUCCESS_RATE = 0.85

const MOCK_ERRORS = [
  "Token expired — please reconnect your account.",
  "File too large for this platform.",
  "Rate limited — try again later.",
  "Upload failed due to a network error.",
  "Video format not supported by this platform.",
]

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function randomLatencyMs() {
  return MIN_LATENCY_MS + Math.random() * (MAX_LATENCY_MS - MIN_LATENCY_MS)
}

// Every method here is mocked for Phase 3. Phases 4-6 replace the body of
// each platform's subclass with real OAuth + API calls; callers never change.
export abstract class MockPlatformService implements PlatformService {
  abstract platform: Platform

  async getAuthUrl(userId: string): Promise<string> {
    const code = `mock_code_${crypto.randomUUID()}`
    return `/api/platforms/mock/callback?platform=${this.platform}&userId=${userId}&code=${code}`
  }

  async handleCallback(
    _code: string,
    userId: string
  ): Promise<{ success: boolean }> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { connectedPlatforms: true },
    })

    if (!user) {
      return { success: false }
    }

    if (!user.connectedPlatforms.includes(this.platform)) {
      await prisma.user.update({
        where: { id: userId },
        data: { connectedPlatforms: { push: this.platform } },
      })
    }

    return { success: true }
  }

  async isConnected(userId: string): Promise<boolean> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { connectedPlatforms: true },
    })

    return user?.connectedPlatforms.includes(this.platform) ?? false
  }

  async disconnect(userId: string): Promise<void> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { connectedPlatforms: true },
    })

    if (!user) return

    await prisma.user.update({
      where: { id: userId },
      data: {
        connectedPlatforms: user.connectedPlatforms.filter(
          (p) => p !== this.platform
        ),
      },
    })
  }

  async publish(): Promise<PublishResult> {
    await sleep(randomLatencyMs())

    if (Math.random() < SUCCESS_RATE) {
      return {
        success: true,
        platformPostId: `${this.platform.toLowerCase()}_${crypto.randomUUID().slice(0, 12)}`,
      }
    }

    const error = MOCK_ERRORS[Math.floor(Math.random() * MOCK_ERRORS.length)]
    return { success: false, error }
  }
}
