import { FileVideo } from "lucide-react"

import { prisma } from "@/lib/prisma"
import { VideoCard } from "@/components/shared/video-card"

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export async function RecentUploads({ userId }: { userId: string }) {
  const [videos] = await Promise.all([
    prisma.video.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 8,
      include: { draft: { select: { id: true } } },
    }),
    delay(600),
  ])

  if (videos.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border py-12 text-center">
        <FileVideo className="size-8 text-muted-foreground" />
        <p className="text-sm font-medium">No uploads yet</p>
        <p className="text-sm text-muted-foreground">
          Upload your first video to see it here.
        </p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
      {videos.map((video) => (
        <VideoCard key={video.id} video={video} draft={video.draft} />
      ))}
    </div>
  )
}
