import { z } from "zod"

export const MAX_VIDEO_SIZE_BYTES = 500 * 1024 * 1024 // 500MB
export const ACCEPTED_VIDEO_TYPES = [
  "video/mp4",
  "video/quicktime",
  "video/webm",
  "video/x-matroska",
  "video/mpeg",
]

export const videoMetadataSchema = z.object({
  title: z.string().min(1, "Title is required").max(200, "Title is too long"),
  description: z.string().max(5000, "Description is too long").optional(),
})

export type VideoMetadataInput = z.infer<typeof videoMetadataSchema>

export const uploadUrlRequestSchema = z.object({
  fileName: z.string().min(1),
  fileType: z.enum(ACCEPTED_VIDEO_TYPES as [string, ...string[]]),
  fileSize: z
    .number()
    .int()
    .positive()
    .max(MAX_VIDEO_SIZE_BYTES, "File is too large. Maximum size is 500MB."),
})

export const thumbnailUploadUrlRequestSchema = z.object({
  assetType: z.literal("thumbnail"),
  fileName: z.string().min(1),
  fileType: z.literal("image/jpeg"),
  fileSize: z.number().int().positive().max(2 * 1024 * 1024, "Thumbnail is too large."),
})

export const finalizeUploadSchema = videoMetadataSchema.extend({
  key: z.string().min(1),
  thumbnailKey: z.string().min(1).optional(),
})
