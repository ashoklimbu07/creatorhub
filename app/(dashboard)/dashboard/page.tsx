import { Suspense } from "react"
import Link from "next/link"
import { redirect } from "next/navigation"
import { UploadCloud } from "lucide-react"

import { Button } from "@/components/ui/button"
import { createClient } from "@/lib/supabase/server"
import { prisma } from "@/lib/prisma"
import { RecentUploads } from "@/components/shared/recent-uploads"
import { RecentUploadsSkeleton } from "@/components/shared/recent-uploads-skeleton"
import { ConnectedAccounts } from "@/components/shared/connected-accounts"

export default async function DashboardPage() {
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
    <div className="flex flex-col gap-8">
      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-semibold">Dashboard</h1>
          <p className="text-muted-foreground">
            Upload once, publish everywhere.
          </p>
        </div>
        <Button asChild size="lg">
          <Link href="/dashboard/upload">
            <UploadCloud />
            Upload video
          </Link>
        </Button>
      </div>

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-medium">Recent uploads</h2>
        <Suspense fallback={<RecentUploadsSkeleton />}>
          <RecentUploads userId={user.id} />
        </Suspense>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-medium">Connected accounts</h2>
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
        />
      </section>
    </div>
  )
}
