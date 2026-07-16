import type { Platform, Privacy } from "@prisma/client"

export type { Platform, Privacy }

export interface PublishInput {
  userId: string
  videoUrl: string
  title: string
  caption: string
  description?: string
  hashtags: string[]
  containsAltered: boolean
  privacy: Privacy
  scheduledAt?: Date
}

export interface PublishResult {
  success: boolean
  platformPostId?: string
  error?: string
}

// Shaped around a real OAuth connect flow so Phases 4-6 can swap the
// internals of each method without changing this interface or any caller.
export interface PlatformService {
  platform: Platform
  getAuthUrl(userId: string): Promise<string>
  handleCallback(code: string, userId: string): Promise<{ success: boolean }>
  isConnected(userId: string): Promise<boolean>
  disconnect(userId: string): Promise<void>
  publish(input: PublishInput): Promise<PublishResult>
}
