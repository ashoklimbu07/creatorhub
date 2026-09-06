import { NextResponse } from "next/server"

import { createClient } from "@/lib/supabase/server"
import { createThumbnailUploadUrl, createUploadUrl } from "@/lib/storage"
import {
  thumbnailUploadUrlRequestSchema,
  uploadUrlRequestSchema,
} from "@/lib/validations/video"

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await request.json().catch(() => null)
  const isThumbnail = body?.assetType === "thumbnail"
  const parsed = isThumbnail
    ? thumbnailUploadUrlRequestSchema.safeParse(body)
    : uploadUrlRequestSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request" },
      { status: 400 }
    )
  }

  const { uploadUrl, key } = isThumbnail
    ? await createThumbnailUploadUrl(user.id)
    : await createUploadUrl(
        user.id,
        parsed.data.fileName,
        parsed.data.fileType
      )

  return NextResponse.json({ uploadUrl, key })
}
