import { redirect } from "next/navigation"

import { getCurrentUser } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getPlatformConnectionsSummary } from "@/lib/platform-connections"
import { ConnectedAccounts } from "@/components/shared/connected-accounts"

export default async function AccountsPage({
  searchParams,
}: {
  searchParams: Promise<{ connected?: string; error?: string }>
}) {
  const { connected, error } = await searchParams

  const user = await getCurrentUser()

  if (!user) {
    redirect("/login")
  }

  const [dbUser, summary] = await Promise.all([
    prisma.user.findUnique({
      where: { id: user.id },
      select: { connectedPlatforms: true },
    }),
    getPlatformConnectionsSummary(user.id),
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
        youtubeConnections={summary.youtube.connections}
        callbackConnected={connected}
        callbackError={error}
      />
    </div>
  )
}
