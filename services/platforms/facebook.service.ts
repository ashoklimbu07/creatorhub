import { MockPlatformService } from "./mock-base"
import type { Platform } from "./types"

class FacebookService extends MockPlatformService {
  platform: Platform = "FACEBOOK"
}

export const facebookService = new FacebookService()
