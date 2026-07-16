import { NextResponse, type NextRequest } from "next/server"

import { createClient } from "@/lib/supabase/server"
import { verifyState } from "@/lib/oauth-state"
import { youtubeService } from "@/services/platforms/youtube.service"

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const code = searchParams.get("code")
  const state = searchParams.get("state")
  const providerError = searchParams.get("error")

  const redirectUrl = new URL("/dashboard/accounts", request.url)

  if (providerError || !code || !state) {
    redirectUrl.searchParams.set("error", "YOUTUBE")
    return NextResponse.redirect(redirectUrl)
  }

  const statePayload = verifyState(state)
  if (!statePayload) {
    redirectUrl.searchParams.set("error", "YOUTUBE")
    return NextResponse.redirect(redirectUrl)
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user || user.id !== statePayload.userId) {
    redirectUrl.searchParams.set("error", "YOUTUBE")
    return NextResponse.redirect(redirectUrl)
  }

  const result = await youtubeService.handleCallback(code, user.id)

  redirectUrl.searchParams.set(result.success ? "connected" : "error", "YOUTUBE")
  return NextResponse.redirect(redirectUrl)
}
