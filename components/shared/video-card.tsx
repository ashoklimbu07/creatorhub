import Link from "next/link"
import { FileVideo } from "lucide-react"
import type { Video, Draft } from "@prisma/client"

import { Card, CardContent } from "@/components/ui/card"
import { VideoStatusBadge } from "@/components/shared/video-status-badge"

type VideoCardProps = {
  video: Pick<Video, "id" | "title" | "thumbnailUrl" | "status" | "createdAt">
  draft?: Pick<Draft, "id"> | null
}

export function VideoCard({ video, draft }: VideoCardProps) {
  const href = draft ? `/dashboard/drafts/${draft.id}` : `/dashboard/drafts`

  return (
    <Link href={href}>
      <Card className="overflow-hidden py-0 transition-colors hover:bg-muted/50">
        <div className="flex aspect-video items-center justify-center bg-muted">
          {video.thumbnailUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={video.thumbnailUrl}
              alt={video.title}
              className="size-full object-cover"
            />
          ) : (
            <FileVideo className="size-8 text-muted-foreground" />
          )}
        </div>
        <CardContent className="flex flex-col gap-2 px-4 pb-4 pt-3">
          <p className="truncate text-sm font-medium">{video.title}</p>
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <VideoStatusBadge status={video.status} />
            <span>{new Date(video.createdAt).toLocaleDateString()}</span>
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}
