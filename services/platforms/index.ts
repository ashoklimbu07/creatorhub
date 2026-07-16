import type { Platform, PlatformService } from "./types"
import { youtubeService } from "./youtube.service"
import { tiktokService } from "./tiktok.service"
import { instagramService } from "./instagram.service"
import { facebookService } from "./facebook.service"

export const platformServices: Record<Platform, PlatformService> = {
  YOUTUBE: youtubeService,
  TIKTOK: tiktokService,
  INSTAGRAM: instagramService,
  FACEBOOK: facebookService,
}

export * from "./types"
