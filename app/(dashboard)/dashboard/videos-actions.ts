"use server"

import { revalidatePath } from "next/cache"

import { prisma } from "@/lib/prisma"
import { createClient } from "@/lib/supabase/server"
import { deleteFile } from "@/lib/storage"

async function requireUserId() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error("Unauthorized")
  }

  return user.id
}

export async function deleteDraft(videoId: string) {
  const userId = await requireUserId()

  const video = await prisma.video.findUnique({
    where: { id: videoId },
    select: { userId: true, fileUrl: true },
  })

  if (!video || video.userId !== userId) {
    throw new Error("Draft not found")
  }

  await prisma.video.delete({ where: { id: videoId } })

  try {
    await deleteFile(video.fileUrl)
  } catch {
    // DB row is already gone; a leftover R2 object isn't worth failing the request over.
  }

  revalidatePath("/dashboard")
  revalidatePath("/dashboard/drafts")
}
