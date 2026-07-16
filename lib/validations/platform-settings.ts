import { z } from "zod"
import type { Platform } from "@prisma/client"

export const platformSettingsSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(1, "Title is required")
      .max(200, "Title is too long"),
    caption: z.string().max(2200, "Caption is too long"),
    description: z.string().max(5000, "Description is too long"),
    hashtags: z
      .array(z.string().min(1).max(50))
      .max(30, "Too many hashtags"),
    privacy: z.enum(["PUBLIC", "UNLISTED", "PRIVATE"]),
    scheduledAt: z.date().nullable(),
  })
  .refine(
    (data) => !data.scheduledAt || data.scheduledAt.getTime() > Date.now(),
    { message: "Schedule must be in the future", path: ["scheduledAt"] }
  )

export type PlatformSettingsInput = z.infer<typeof platformSettingsSchema>

// Real-world constraint: only YouTube supports a separate long-form
// description field alongside the caption.
export const PLATFORMS_WITH_DESCRIPTION: Platform[] = ["YOUTUBE"]

export const platformLabels: Record<Platform, string> = {
  YOUTUBE: "YouTube",
  TIKTOK: "TikTok",
  INSTAGRAM: "Instagram",
  FACEBOOK: "Facebook",
}
