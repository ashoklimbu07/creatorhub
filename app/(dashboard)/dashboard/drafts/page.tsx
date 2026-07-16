import Link from "next/link"
import { redirect } from "next/navigation"
import { FileVideo } from "lucide-react"

import { createClient } from "@/lib/supabase/server"
import { prisma } from "@/lib/prisma"
import { formatFileSize } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { VideoStatusBadge } from "@/components/shared/video-status-badge"
import { DeleteDraftButton } from "@/components/shared/delete-draft-button"

export default async function DraftsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/login")
  }

  const drafts = await prisma.draft.findMany({
    where: { video: { userId: user.id } },
    orderBy: { lastEditedAt: "desc" },
    include: { video: true },
  })

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Drafts</h1>
        <p className="text-muted-foreground">
          Videos you&apos;ve uploaded but haven&apos;t published yet.
        </p>
      </div>

      {drafts.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border py-16 text-center">
          <FileVideo className="size-8 text-muted-foreground" />
          <p className="text-sm font-medium">No drafts yet</p>
          <p className="text-sm text-muted-foreground">
            Upload a video to start a new draft.
          </p>
          <Button asChild className="mt-2">
            <Link href="/dashboard/upload">Upload video</Link>
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {drafts.map((draft) => (
            <Card key={draft.id}>
              <CardContent className="flex flex-col gap-4 px-4 py-4 sm:flex-row sm:items-center">
                <div className="flex h-16 w-28 shrink-0 items-center justify-center rounded-md bg-muted">
                  {draft.video.thumbnailUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={draft.video.thumbnailUrl}
                      alt={draft.video.title}
                      className="size-full rounded-md object-cover"
                    />
                  ) : (
                    <FileVideo className="size-6 text-muted-foreground" />
                  )}
                </div>

                <div className="flex flex-1 flex-col gap-1">
                  <p className="truncate font-medium">{draft.video.title}</p>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <VideoStatusBadge status={draft.video.status} />
                    <span>
                      Last edited{" "}
                      {new Date(draft.lastEditedAt).toLocaleDateString()}
                    </span>
                    {draft.video.sizeBytes != null && (
                      <span>{formatFileSize(draft.video.sizeBytes)}</span>
                    )}
                  </div>
                </div>

                <div className="flex shrink-0 gap-2">
                  <Button asChild size="sm">
                    <Link href={`/dashboard/drafts/${draft.id}`}>
                      Continue editing
                    </Link>
                  </Button>
                  <DeleteDraftButton videoId={draft.video.id} />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
