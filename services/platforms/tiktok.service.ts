import { MockPlatformService } from "./mock-base"
import type { Platform } from "./types"

class TikTokService extends MockPlatformService {
  platform: Platform = "TIKTOK"
}

export const tiktokService = new TikTokService()
