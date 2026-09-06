import { type NextRequest } from "next/server"
import { updateSession } from "@/lib/supabase/middleware"

export async function middleware(request: NextRequest) {
  return await updateSession(request)
}

export const config = {
  matcher: [
    // Exclude /api: route handlers do their own auth checks, and Next.js
    // buffers request bodies through middleware (capped at 10MB by default),
    // which would break large payloads if any route handler ever took one
    // directly (video bytes now go straight to R2, bypassing this entirely).
    "/((?!_next/static|_next/image|favicon.ico|api|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
}
