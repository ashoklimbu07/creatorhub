import { NextResponse, after } from "next/server"

import { createClient } from "@/lib/supabase/server"
import { prisma } from "@/lib/prisma"
import { getObjectSize, deleteFile } from "@/lib/storage"
import { enforceStorageQuota, gb } from "@/lib/storage-quota"
import { finalizeUploadSchema } from "@/lib/validations/video"

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await request.json().catch(() => null)
  const parsed = finalizeUploadSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    )
  }

  const { key, thumbnailKey, title, description, width, height } = parsed.data

  // Keys are minted per-user in createUploadUrl (videos/{userId}/{uuid}{ext});
  // reject anything that doesn't belong to the caller before touching R2.
  if (!key.startsWith(`videos/${user.id}/`)) {
    return NextResponse.json({ error: "Invalid upload key" }, { status: 403 })
  }

  if (thumbnailKey && !thumbnailKey.startsWith(`thumbnails/${user.id}/`)) {
    return NextResponse.json({ error: "Invalid thumbnail key" }, { status: 403 })
  }

  const size = await getObjectSize(key)
  if (size === null) {
    return NextResponse.json(
      { error: "Upload did not complete. Please try again." },
      { status: 400 }
    )
  }


  if (thumbnailKey && (await getObjectSize(thumbnailKey)) === null) {
    return NextResponse.json(
      { error: "Thumbnail upload did not complete. Please try again." },
      { status: 400 }
    )
  }

  const video = await prisma.video.create({
    data: {
      userId: user.id,
      title,
      description: description ?? null,
      fileUrl: key,
      thumbnailUrl: thumbnailKey ?? null,
      sizeBytes: BigInt(size),
      width: width ?? null,
      height: height ?? null,
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

// If the client abandons the flow after getting a presigned URL but before
// calling finalize, this lets the upload page clean up the orphaned R2
// object instead of leaving it to the next storage-quota sweep.
export async function DELETE(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await request.json().catch(() => null)
  const key = typeof body?.key === "string" ? body.key : null
  const thumbnailKey = typeof body?.thumbnailKey === "string" ? body.thumbnailKey : null

  if (!key || !key.startsWith(`videos/${user.id}/`)) {
    return NextResponse.json({ error: "Invalid upload key" }, { status: 403 })
  }

  await deleteFile(key)
  if (thumbnailKey?.startsWith(`thumbnails/${user.id}/`)) {
    await deleteFile(thumbnailKey)
  }
  return NextResponse.json({ ok: true })
}
