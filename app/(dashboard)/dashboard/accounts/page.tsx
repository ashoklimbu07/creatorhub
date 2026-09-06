import { redirect } from "next/navigation"

import { createClient } from "@/lib/supabase/server"
import { prisma } from "@/lib/prisma"
import { getPlatformConnectionsSummary } from "@/lib/platform-connections"
import { facebookService } from "@/services/platforms/facebook.service"
import { ConnectedAccounts } from "@/components/shared/connected-accounts"

export default async function AccountsPage({
  searchParams,
}: {
  searchParams: Promise<{ connected?: string; error?: string; fbPick?: string }>
}) {
  const { connected, error } = await searchParams

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/login")
  }

  const [dbUser, summary, pendingFacebookPages] = await Promise.all([
    prisma.user.findUnique({
      where: { id: user.id },
      select: { connectedPlatforms: true },
    }),
    getPlatformConnectionsSummary(user.id),
    facebookService.getPendingPages(user.id),
  ])

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
        connections={summary.singleConnections}
        facebookConnections={summary.facebook.connections}
        pendingFacebookPages={pendingFacebookPages}
        manageFacebook
        callbackConnected={connected}
        callbackError={error}
      />
    </div>
  )
}
