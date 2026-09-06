import { z } from "zod"
import type { Platform, PlatformSettings } from "@prisma/client"

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
    containsAltered: z.boolean(),
    privacy: z.enum(["PUBLIC", "UNLISTED", "PRIVATE"]),
    scheduledAt: z.date().nullable(),
  })
  .refine(
    (data) => !data.scheduledAt || data.scheduledAt.getTime() > Date.now(),
    { message: "Schedule must be in the future", path: ["scheduledAt"] }
  )

export type PlatformSettingsInput = z.infer<typeof platformSettingsSchema>

// Per-platform: YouTube requires a description, everything else requires a
// caption (see PLATFORMS_WITH_DESCRIPTION below) — enforced both on the
// client (so Save itself blocks an empty required field) and again in the
// savePlatformSettings server action, since publish-readiness depends on it.
export function platformSettingsSchemaFor(platform: Platform) {
  const requiresDescription = PLATFORMS_WITH_DESCRIPTION.includes(platform)
  const field = requiresDescription ? "description" : "caption"
  const label = requiresDescription ? "Description" : "Caption"

  return platformSettingsSchema.refine(
    (data) => Boolean(data[field].trim()),
    { message: `${label} is required`, path: [field] }
  )
}

// Aspect ratios each platform's short-form video surface (Shorts/TikTok
// feed/Reels) actually accepts without letterboxing or a forced crop. Not
// persisted — purely a reference/pre-export check for the creator, since the
// video file itself is uploaded once and shared across every platform tab.
export const ASPECT_RATIOS = ["9:16", "1:1", "4:5", "16:9"] as const
export type AspectRatio = (typeof ASPECT_RATIOS)[number]

export const DEFAULT_ASPECT_RATIO: AspectRatio = "9:16"

export const aspectRatiosByPlatform: Record<Platform, AspectRatio[]> = {
  YOUTUBE: ["9:16", "16:9", "1:1"],
  TIKTOK: ["9:16", "1:1", "16:9"],
  INSTAGRAM: ["9:16", "4:5", "1:1"],
  FACEBOOK: ["9:16", "4:5", "1:1"],
}

// Real-world constraint: only YouTube has a separate long-form description
// field — it has no "caption" concept at all, so its tab uses description in
// place of caption everywhere (required-field checks, tags label, etc).
export const PLATFORMS_WITH_DESCRIPTION: Platform[] = ["YOUTUBE"]

export const platformLabels: Record<Platform, string> = {
  YOUTUBE: "YouTube",
  TIKTOK: "TikTok",
  INSTAGRAM: "Instagram",
  FACEBOOK: "Facebook",
}

// YouTube calls this field "Tags," not hashtags.
export const hashtagsFieldLabel: Record<Platform, string> = {
  YOUTUBE: "Tags",
  TIKTOK: "Hashtags",
  INSTAGRAM: "Hashtags",
  FACEBOOK: "Hashtags",
}

// Instagram's Content Publishing API has no public/unlisted/private option —
// published media is always visible per the account's own privacy settings,
// so the Privacy field is purely cosmetic there.
export const privacyLimitationNote: Partial<Record<Platform, string>> = {
  INSTAGRAM:
    "Instagram's API doesn't support publishing as unlisted or private — this is ignored and the post follows your account's privacy settings.",
}

export function isPlatformSettingsComplete(
  platform: Platform,
  settings: PlatformSettings | null | undefined
): settings is PlatformSettings {
  if (!settings || !settings.title.trim()) return false
  const contentField = PLATFORMS_WITH_DESCRIPTION.includes(platform)
    ? settings.description
    : settings.caption
  return Boolean(contentField?.trim())
}
