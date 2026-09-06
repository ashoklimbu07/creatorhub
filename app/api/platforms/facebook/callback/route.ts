import { NextResponse, type NextRequest } from "next/server"

import { createClient } from "@/lib/supabase/server"
import { verifyState } from "@/lib/oauth-state"
import { facebookService } from "@/services/platforms/facebook.service"

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const code = searchParams.get("code")
  const state = searchParams.get("state")
  const providerError = searchParams.get("error")

  const redirectUrl = new URL("/dashboard/accounts", request.url)

  if (providerError || !code || !state) {
    console.error("[facebook] callback guard failed: provider/code/state", {
      providerError,
      hasCode: Boolean(code),
      hasState: Boolean(state),
    })
    redirectUrl.searchParams.set("error", "FACEBOOK")
    return NextResponse.redirect(redirectUrl)
  }

  const statePayload = verifyState(state)
  if (!statePayload) {
    console.error("[facebook] callback guard failed: verifyState returned null")
    redirectUrl.searchParams.set("error", "FACEBOOK")
    return NextResponse.redirect(redirectUrl)
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user || user.id !== statePayload.userId) {
    console.error("[facebook] callback guard failed: user mismatch", {
      hasUser: Boolean(user),
      userId: user?.id,
      stateUserId: statePayload.userId,
    })
    redirectUrl.searchParams.set("error", "FACEBOOK")
    return NextResponse.redirect(redirectUrl)
  }

  const result = await facebookService.handleCallback(code, user.id)

  if (!result.success) {
    redirectUrl.searchParams.set("error", result.reason === "NO_PAGES" ? "FACEBOOK_NO_PAGES" : "FACEBOOK")
    return NextResponse.redirect(redirectUrl)
  }

  // Multiple Pages means the OAuth exchange succeeded but there's no
  // PlatformConnection yet — send the user to the picker instead of
  // flashing a premature "connected" toast.
  if (await facebookService.hasPendingPages(user.id)) {
    redirectUrl.searchParams.set("fbPick", "1")
  } else {
    redirectUrl.searchParams.set("connected", "FACEBOOK")
  }
  return NextResponse.redirect(redirectUrl)
}
