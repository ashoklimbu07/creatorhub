import { NextResponse, type NextRequest } from "next/server"

import { createClient } from "@/lib/supabase/server"
import { platformServices, type Platform } from "@/services/platforms"

// Real TikTok callbacks must pass the browser-bound state check in its own route.
const VALID_PLATFORMS = new Set(Object.keys(platformServices).filter((p) => p !== "TIKTOK"))

// Stands in for a real provider's OAuth redirect target. Phases 4-6 point
// the "authorize" URL at the real provider instead, but this route (and the
// redirect-back-with-a-code shape) stays the same.
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const platform = searchParams.get("platform")
  const userId = searchParams.get("userId")
  const code = searchParams.get("code")

  const redirectUrl = new URL("/dashboard/accounts", request.url)

  if (!platform || !userId || !code || !VALID_PLATFORMS.has(platform)) {
    redirectUrl.searchParams.set("error", "invalid_callback")
    return NextResponse.redirect(redirectUrl)
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user || user.id !== userId) {
    redirectUrl.searchParams.set("error", "unauthorized")
    return NextResponse.redirect(redirectUrl)
  }

  const service = platformServices[platform as Platform]
  const result = await service.handleCallback(code, userId)

  redirectUrl.searchParams.set(result.success ? "connected" : "error", platform)
  return NextResponse.redirect(redirectUrl)
}
