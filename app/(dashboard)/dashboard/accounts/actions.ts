"use server"

import { redirect } from "next/navigation"
import { revalidatePath } from "next/cache"

import { createClient } from "@/lib/supabase/server"
import { platformServices, type Platform } from "@/services/platforms"

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

export async function connectPlatform(platform: Platform) {
  const userId = await requireUserId()
  const authUrl = await platformServices[platform].getAuthUrl(userId)
  redirect(authUrl)
}

export async function disconnectPlatform(platform: Platform) {
  const userId = await requireUserId()
  await platformServices[platform].disconnect(userId)
  revalidatePath("/dashboard/accounts")
}
