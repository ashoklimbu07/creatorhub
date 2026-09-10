"use server"

import { redirect } from "next/navigation"
import { revalidatePath } from "next/cache"

import { createClient } from "@/lib/supabase/server"
import { platformServices, type Platform } from "@/services/platforms"
import { facebookService } from "@/services/platforms/facebook.service"
import { youtubeService } from "@/services/platforms/youtube.service"
import { tiktokService } from "@/services/platforms/tiktok.service"
import { instagramService } from "@/services/platforms/instagram.service"

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

export async function disconnectFacebookPage(connectionId: string) {
  const userId = await requireUserId()
  const result = await facebookService.disconnectPage(userId, connectionId)
  if (!result.success) {
    throw new Error("Failed to disconnect that Page")
  }
  revalidatePath("/dashboard/accounts")
  revalidatePath("/dashboard")
}

export async function setDefaultFacebookPage(connectionId: string) {
  const userId = await requireUserId()
  const result = await facebookService.setDefaultPage(userId, connectionId)
  if (!result.success) {
    throw new Error("Failed to set that Page as default")
  }
  revalidatePath("/dashboard/accounts")
  revalidatePath("/dashboard")
}

export async function disconnectYouTubeChannel(connectionId: string) {
  const userId = await requireUserId()
  const result = await youtubeService.disconnectChannel(userId, connectionId)
  if (!result.success) {
    throw new Error("Failed to disconnect that channel")
  }
  revalidatePath("/dashboard/accounts")
  revalidatePath("/dashboard")
}

export async function setDefaultYouTubeChannel(connectionId: string) {
  const userId = await requireUserId()
  const result = await youtubeService.setDefaultChannel(userId, connectionId)
  if (!result.success) {
    throw new Error("Failed to set that channel as default")
  }
  revalidatePath("/dashboard/accounts")
  revalidatePath("/dashboard")
}

export async function disconnectInstagramAccount(connectionId: string) {
  const userId = await requireUserId()
  const result = await instagramService.disconnectAccount(userId, connectionId)
  if (!result.success) {
    throw new Error("Failed to disconnect that account")
  }
  revalidatePath("/dashboard/accounts")
  revalidatePath("/dashboard")
}

export async function setDefaultInstagramAccount(connectionId: string) {
  const userId = await requireUserId()
  const result = await instagramService.setDefaultAccount(userId, connectionId)
  if (!result.success) {
    throw new Error("Failed to set that account as default")
  }
  revalidatePath("/dashboard/accounts")
  revalidatePath("/dashboard")
}

export async function disconnectTikTokAccount(connectionId: string) {
  const userId = await requireUserId()
  const result = await tiktokService.disconnectAccount(userId, connectionId)
  if (!result.success) {
    throw new Error("Failed to disconnect that account")
  }
  revalidatePath("/dashboard/accounts")
  revalidatePath("/dashboard")
}

export async function setDefaultTikTokAccount(connectionId: string) {
  const userId = await requireUserId()
  const result = await tiktokService.setDefaultAccount(userId, connectionId)
  if (!result.success) {
    throw new Error("Failed to set that account as default")
  }
  revalidatePath("/dashboard/accounts")
  revalidatePath("/dashboard")
}
