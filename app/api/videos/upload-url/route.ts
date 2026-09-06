import { NextResponse } from "next/server"

import { createClient } from "@/lib/supabase/server"
import { createUploadUrl } from "@/lib/storage"
import { uploadUrlRequestSchema } from "@/lib/validations/video"

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await request.json().catch(() => null)
  const parsed = uploadUrlRequestSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request" },
      { status: 400 }
    )
  }

  const { uploadUrl, key } = await createUploadUrl(
    user.id,
    parsed.data.fileName,
    parsed.data.fileType
  )

  return NextResponse.json({ uploadUrl, key })
}
