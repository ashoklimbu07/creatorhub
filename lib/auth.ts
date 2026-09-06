import { cache } from "react"

import { createClient } from "@/lib/supabase/server"

/**
 * React scopes this cache to a server render, so the dashboard layout and page
 * can share one verified Supabase user lookup during the same navigation.
 */
export const getCurrentUser = cache(async () => {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  return user
})
