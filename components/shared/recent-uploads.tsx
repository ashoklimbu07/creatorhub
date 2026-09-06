import { FileVideo } from "lucide-react"

import { prisma } from "@/lib/prisma"
import { getSignedAssetUrl, getSignedVideoUrl } from "@/lib/storage"
import { VideoCard } from "@/components/shared/video-card"

export async function RecentUploads({ userId }: { userId: string }) {
  const videos = await prisma.video.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 8,
    include: {
      draft: { select: { id: true } },
      platformSettings: {
        where: { publishStatus: "SUCCESS" },
        select: { platform: true },
      },
    },
  })

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

  const videosWithPreviews = await Promise.all(
    videos.map(async (video) => ({
      ...video,
      previewUrl: video.thumbnailUrl
        ? await getSignedAssetUrl(video.thumbnailUrl)
        : `${await getSignedVideoUrl(video.fileUrl)}#t=0.1`,
      previewType: video.thumbnailUrl ? ("image" as const) : ("video" as const),
    }))
  )

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
      {videosWithPreviews.map((video) => (
        <VideoCard
          key={video.id}
          video={video}
          draft={video.draft}
          previewUrl={video.previewUrl}
          previewType={video.previewType}
          publishedPlatforms={video.platformSettings.map(({ platform }) => platform)}
        />
      ))}
    </div>
  )
}
