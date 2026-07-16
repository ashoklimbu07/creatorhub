import { MockPlatformService } from "./mock-base"
import type { Platform } from "./types"

class InstagramService extends MockPlatformService {
  platform: Platform = "INSTAGRAM"
}

export const instagramService = new InstagramService()
