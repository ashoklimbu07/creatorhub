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
