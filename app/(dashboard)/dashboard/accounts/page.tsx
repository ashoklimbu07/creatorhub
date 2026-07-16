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

  const [dbUser, youtubeConnection] = await Promise.all([
    prisma.user.findUnique({
      where: { id: user.id },
      select: { connectedPlatforms: true },
    }),
    prisma.platformConnection.findUnique({
      where: { userId_platform: { userId: user.id, platform: "YOUTUBE" } },
      select: { externalAccountName: true, externalAccountThumbnail: true },
    }),
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
        youtubeConnection={
          youtubeConnection
            ? {
                name: youtubeConnection.externalAccountName,
                thumbnailUrl: youtubeConnection.externalAccountThumbnail,
              }
            : null
        }
        callbackConnected={connected}
        callbackError={error}
      />
    </div>
  )
}
