import { NextResponse, after } from "next/server"

import { createClient } from "@/lib/supabase/server"
import { prisma } from "@/lib/prisma"
import { uploadFile } from "@/lib/storage"
import { enforceStorageQuota, gb } from "@/lib/storage-quota"
import {
  videoMetadataSchema,
  ACCEPTED_VIDEO_TYPES,
  MAX_VIDEO_SIZE_BYTES,
} from "@/lib/validations/video"

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const formData = await request.formData()
  const file = formData.get("file")
  const title = formData.get("title")
  const description = formData.get("description")

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 })
  }

  if (!ACCEPTED_VIDEO_TYPES.includes(file.type)) {
    return NextResponse.json(
      { error: "Unsupported file type. Please upload a video file." },
      { status: 400 }
    )
  }

  if (file.size > MAX_VIDEO_SIZE_BYTES) {
    return NextResponse.json(
      { error: "File is too large. Maximum size is 500MB." },
      { status: 400 }
    )
  }

  const parsed = videoMetadataSchema.safeParse({
    title,
    description: description || undefined,
  })

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    )
  }

  const { url, size } = await uploadFile(file)

  const video = await prisma.video.create({
    data: {
      userId: user.id,
      title: parsed.data.title,
      description: parsed.data.description ?? null,
      fileUrl: url,
      sizeBytes: BigInt(size),
      status: "DRAFT",
      draft: {
        create: {},
      },
    },
    include: { draft: true },
  })

  after(async () => {
    try {
      const result = await enforceStorageQuota()
      if (result.deletedCount > 0) {
        console.log(
          `[storage-quota] over 9GB (${gb(result.usageBytes)}GB) — deleted ${result.deletedCount} oldest video(s), new usage ~${gb(result.finalUsageBytes)}GB`
        )
      }
    } catch (err) {
      console.error("[storage-quota] enforcement failed:", err)
    }
  })

  return NextResponse.json({
    videoId: video.id,
    draftId: video.draft!.id,
  })
}
