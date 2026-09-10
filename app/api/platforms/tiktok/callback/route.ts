import { NextResponse, type NextRequest } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { tiktokService } from "@/services/platforms/tiktok.service"

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams
  const code = params.get("code")
  const state = params.get("state")
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const valid = user && state && code && !params.get("error") &&
    request.cookies.get("tiktok_oauth_state")?.value === `${user.id}:${state}`
  const result = valid ? await tiktokService.handleCallback(code, user.id) : { success: false }
  const url = new URL("/dashboard/accounts", request.url)
  url.searchParams.set(result.success ? "connected" : "error", "TIKTOK")
  const response = NextResponse.redirect(url)
  response.cookies.set("tiktok_oauth_state", "", {
    httpOnly: true, secure: true, sameSite: "lax", path: "/api/platforms/tiktok", maxAge: 0,
  })
  return response
}
