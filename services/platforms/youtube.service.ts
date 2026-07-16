import { MockPlatformService } from "./mock-base"
import type { Platform } from "./types"

class YouTubeService extends MockPlatformService {
  platform: Platform = "YOUTUBE"
}

export const youtubeService = new YouTubeService()
