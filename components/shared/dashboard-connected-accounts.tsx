import { prisma } from "@/lib/prisma"
import { getPlatformConnectionsSummary } from "@/lib/platform-connections"
import { ConnectedAccounts } from "@/components/shared/connected-accounts"

export async function DashboardConnectedAccounts({ userId }: { userId: string }) {
  const [dbUser, summary] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { connectedPlatforms: true },
    }),
    getPlatformConnectionsSummary(userId),
  ])

  return (
    <ConnectedAccounts
      initialConnected={dbUser?.connectedPlatforms ?? []}
      connections={summary.singleConnections}
      facebookConnections={summary.facebook.connections}
    />
  )
}
