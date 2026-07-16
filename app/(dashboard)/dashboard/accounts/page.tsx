import { redirect } from "next/navigation"

import { createClient } from "@/lib/supabase/server"
import { prisma } from "@/lib/prisma"
import { ConnectedAccounts } from "@/components/shared/connected-accounts"

export default async function AccountsPage({
  searchParams,
}: {
  searchParams: Promise<{ connected?: string; error?: string }>
}) {
  const { connected, error } = await searchParams

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/login")
  }

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { connectedPlatforms: true },
  })

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Connected accounts</h1>
        <p className="text-muted-foreground">
          Connect the platforms you want to publish to.
        </p>
      </div>
      <ConnectedAccounts
        initialConnected={dbUser?.connectedPlatforms ?? []}
        callbackConnected={connected}
        callbackError={error}
      />
    </div>
  )
}
