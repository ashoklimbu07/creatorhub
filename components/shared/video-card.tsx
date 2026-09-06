import Link from "next/link"
import { Camera, FileVideo, Music2, PlaySquare, ThumbsUp } from "lucide-react"
import type { Video, Draft, Platform } from "@prisma/client"

import { Card, CardContent } from "@/components/ui/card"
import { VideoStatusBadge } from "@/components/shared/video-status-badge"

type VideoCardProps = {
  video: Pick<Video, "id" | "title" | "thumbnailUrl" | "status" | "createdAt">
  draft?: Pick<Draft, "id"> | null
  publishedPlatforms?: Platform[]
  previewUrl?: string | null
  previewType?: "image" | "video"
}

const platformIcons: Record<
  Platform,
  { label: string; icon: React.ComponentType<{ className?: string }> }
> = {
  YOUTUBE: { label: "YouTube", icon: PlaySquare },
  TIKTOK: { label: "TikTok", icon: Music2 },
  INSTAGRAM: { label: "Instagram", icon: Camera },
  FACEBOOK: { label: "Facebook", icon: ThumbsUp },
}

export function VideoCard({
  video,
  draft,
  publishedPlatforms = [],
  previewUrl,
  previewType = "image",
}: VideoCardProps) {
  const href = draft ? `/dashboard/drafts/${draft.id}` : `/dashboard/drafts`

  return (
    <Link href={href}>
      <Card className="overflow-hidden py-0 transition-colors hover:bg-muted/50">
        <div className="flex aspect-video items-center justify-center bg-muted">
          {previewUrl && previewType === "image" ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={previewUrl}
              alt={video.title}
              className="size-full object-cover"
            />
          ) : previewUrl ? (
            <video
              src={previewUrl}
              muted
              playsInline
              preload="metadata"
              aria-label={`${video.title} preview`}
              className="size-full object-cover"
            />
          ) : (
            <FileVideo className="size-8 text-muted-foreground" />
          )}
        </div>
        <CardContent className="flex flex-col gap-2 px-4 pb-4 pt-3">
          <p className="truncate text-sm font-medium">{video.title}</p>
          <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
            <div className="flex min-w-0 items-center gap-2">
              <VideoStatusBadge status={video.status} />
              {publishedPlatforms.length > 0 && (
                <div
                  className="flex items-center gap-1"
                  aria-label={`Published to ${publishedPlatforms
                    .map((platform) => platformIcons[platform].label)
                    .join(", ")}`}
                >
                  {publishedPlatforms.map((platform) => {
                    const { icon: Icon, label } = platformIcons[platform]
                    return (
                      <span
                        key={platform}
                        title={label}
                        className="flex size-5 items-center justify-center rounded-full border bg-background"
                      >
                        <Icon className="size-3" />
                        <span className="sr-only">{label}</span>
                      </span>
                    )
                  })}
                </div>
              )}
            </div>
            <span>{new Date(video.createdAt).toLocaleDateString()}</span>
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}
