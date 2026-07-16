import { type NextRequest } from "next/server"
import { updateSession } from "@/lib/supabase/middleware"

export async function middleware(request: NextRequest) {
  return await updateSession(request)
}

export const config = {
  matcher: [
    // Exclude /api: route handlers do their own auth checks, and Next.js
    // buffers request bodies through middleware (capped at 10MB by default),
    // which breaks large file uploads like /api/videos/upload.
    "/((?!_next/static|_next/image|favicon.ico|api|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
}
