import { notFound, redirect } from "next/navigation"
import { Share2 } from "lucide-react"

import { createClient } from "@/lib/supabase/server"
import { prisma } from "@/lib/prisma"
import { getSignedVideoUrl } from "@/lib/storage"
import { formatFileSize } from "@/lib/utils"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { VideoStatusBadge } from "@/components/shared/video-status-badge"
import { DeleteDraftButton } from "@/components/shared/delete-draft-button"

export default async function DraftDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/login")
  }

  const draft = await prisma.draft.findUnique({
    where: { id },
    include: { video: true },
  })

  if (!draft || draft.video.userId !== user.id) {
    notFound()
  }

  const { video } = draft
  const videoUrl = await getSignedVideoUrl(video.fileUrl)

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-semibold">{video.title}</h1>
          <div className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
            <VideoStatusBadge status={video.status} />
            <span>
              Last edited {new Date(draft.lastEditedAt).toLocaleDateString()}
            </span>
            {video.sizeBytes != null && (
              <span>{formatFileSize(video.sizeBytes)}</span>
            )}
          </div>
        </div>
        <DeleteDraftButton videoId={video.id} redirectTo="/dashboard/drafts" />
      </div>

      <Card className="overflow-hidden py-0">
        <video
          src={videoUrl}
          controls
          className="aspect-video w-full bg-black"
        />
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Details</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div>
            <p className="text-sm font-medium text-muted-foreground">Title</p>
            <p>{video.title}</p>
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground">
              Description
            </p>
            <p className={video.description ? "" : "text-muted-foreground"}>
              {video.description || "No description provided."}
            </p>
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground">
              File size
            </p>
            <p>
              {video.sizeBytes != null ? formatFileSize(video.sizeBytes) : "Unknown"}
            </p>
          </div>
        </CardContent>
      </Card>

      <Card className="border-dashed">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Share2 className="size-4 text-muted-foreground" />
            <CardTitle>Platform settings</CardTitle>
          </div>
          <CardDescription>
            Per-platform titles, captions, hashtags, privacy, and scheduling
            are coming in Phase 3.
          </CardDescription>
        </CardHeader>
      </Card>
    </div>
  )
}
