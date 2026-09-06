import { NextResponse, type NextRequest } from "next/server"

import { createClient } from "@/lib/supabase/server"
import { instagramService } from "@/services/platforms/instagram.service"

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.redirect(new URL("/login", request.url))
  }

  const authUrl = await instagramService.getAuthUrl(user.id)
  return NextResponse.redirect(authUrl)
}
