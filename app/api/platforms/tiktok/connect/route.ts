import { randomBytes } from "node:crypto"
import { NextResponse, type NextRequest } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { buildTikTokAuthorizeUrl } from "@/services/platforms/tiktok-oauth"

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.redirect(new URL("/login", request.url))
  try {
    const state = randomBytes(32).toString("hex")
    const response = NextResponse.redirect(buildTikTokAuthorizeUrl(state))
    response.cookies.set("tiktok_oauth_state", `${user.id}:${state}`, {
      httpOnly: true, secure: true, sameSite: "lax", path: "/api/platforms/tiktok", maxAge: 600,
    })
    return response
  } catch {
    return NextResponse.redirect(new URL("/dashboard/accounts?error=TIKTOK_CONFIG", request.url))
  }
}
