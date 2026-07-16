"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import {
  PlaySquare,
  Music2,
  Camera,
  ThumbsUp,
  Loader2,
  CheckCircle2,
  XCircle,
  Upload,
} from "lucide-react"
import type { Platform, PlatformSettings } from "@prisma/client"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Card, CardContent } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import {
  platformLabels,
  isPlatformSettingsComplete,
} from "@/lib/validations/platform-settings"
import {
  startPublishBatch,
  publishPlatform,
  type PublishPlatformResult,
} from "@/app/(dashboard)/dashboard/drafts/[id]/actions"

const PLATFORM_ICONS: Record<
  Platform,
  React.ComponentType<{ className?: string }>
> = {
  YOUTUBE: PlaySquare,
  TIKTOK: Music2,
  INSTAGRAM: Camera,
  FACEBOOK: ThumbsUp,
}

const ALL_PLATFORMS: Platform[] = ["YOUTUBE", "TIKTOK", "INSTAGRAM", "FACEBOOK"]

type ResultState = {
  status: "pending" | "publishing" | "success" | "failed"
  error?: string
  platformPostId?: string
}

export function PublishPanel({
  videoId,
  settingsByPlatform,
}: {
  videoId: string
  settingsByPlatform: Record<Platform, PlatformSettings | null>
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [phase, setPhase] = useState<"confirm" | "progress">("confirm")
  const [batch, setBatch] = useState<Platform[]>([])
  const [results, setResults] = useState<Partial<Record<Platform, ResultState>>>({})
  const [retryTick, setRetryTick] = useState<Partial<Record<Platform, number>>>({})

  const eligiblePlatforms = ALL_PLATFORMS.filter((platform) =>
    isPlatformSettingsComplete(platform, settingsByPlatform[platform])
  )
  const notEligible = ALL_PLATFORMS.filter((p) => !eligiblePlatforms.includes(p))
  const isPublishing = batch.some((p) => {
    const status = results[p]?.status
    return status === "pending" || status === "publishing"
  })

  function openDialog() {
    if (!isPublishing) {
      setPhase("confirm")
      setResults({})
    }
    setOpen(true)
  }

  async function runPlatform(
    platform: Platform,
    platforms: Platform[]
  ): Promise<PublishPlatformResult> {
    setResults((prev) => ({ ...prev, [platform]: { status: "publishing" } }))
    try {
      const result = await publishPlatform(videoId, platform, platforms)
      setResults((prev) => ({
        ...prev,
        [platform]: {
          status: result.success ? "success" : "failed",
          error: result.error,
          platformPostId: result.platformPostId,
        },
      }))
      return result
    } catch {
      const fallback: PublishPlatformResult = {
        platform,
        success: false,
        error: "Unexpected error while publishing.",
      }
      setResults((prev) => ({
        ...prev,
        [platform]: { status: "failed", error: fallback.error },
      }))
      return fallback
    }
  }

  async function handleConfirm() {
    const platforms = eligiblePlatforms
    setBatch(platforms)
    setPhase("progress")
    setResults(
      Object.fromEntries(
        platforms.map((p) => [p, { status: "pending" as const }])
      )
    )

    await startPublishBatch(videoId, platforms)
    router.refresh()

    const settled = await Promise.all(
      platforms.map((platform) => runPlatform(platform, platforms))
    )

    const successCount = settled.filter((r) => r.success).length
    const message = `${successCount}/${platforms.length} platforms published successfully`
    if (successCount === platforms.length) {
      toast.success(message)
    } else if (successCount > 0) {
      toast.warning(message)
    } else {
      toast.error(message)
    }
    router.refresh()
  }

  async function handleRetry(platform: Platform) {
    setRetryTick((prev) => ({ ...prev, [platform]: (prev[platform] ?? 0) + 1 }))
    const result = await runPlatform(platform, batch)
    if (result.success) {
      toast.success(`${platformLabels[platform]} published`)
    } else {
      toast.error(`${platformLabels[platform]} failed: ${result.error}`)
    }
    router.refresh()
  }

  return (
    <>
      <Button type="button" onClick={openDialog}>
        <Upload />
        Publish
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          {phase === "confirm" ? (
            <>
              <DialogHeader>
                <DialogTitle>Publish this video?</DialogTitle>
                <DialogDescription>
                  {eligiblePlatforms.length === 0
                    ? "No platforms are ready yet — fill in a title and caption (or description for YouTube) on at least one tab."
                    : "These platforms are filled in and will be published:"}
                </DialogDescription>
              </DialogHeader>

              {eligiblePlatforms.length > 0 && (
                <div className="flex flex-col gap-2">
                  {eligiblePlatforms.map((platform) => {
                    const Icon = PLATFORM_ICONS[platform]
                    return (
                      <div
                        key={platform}
                        className="flex items-center gap-2 text-sm"
                      >
                        <Icon className="size-4 text-muted-foreground" />
                        {platformLabels[platform]}
                      </div>
                    )
                  })}
                  {notEligible.length > 0 && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Skipping {notEligible.map((p) => platformLabels[p]).join(", ")}{" "}
                      — incomplete tab.
                    </p>
                  )}
                </div>
              )}

              <DialogFooter>
                <Button
                  type="button"
                  onClick={handleConfirm}
                  disabled={eligiblePlatforms.length === 0}
                >
                  Confirm & publish
                </Button>
              </DialogFooter>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>Publishing…</DialogTitle>
                <DialogDescription>
                  You can close this dialog — publishing continues in the
                  background.
                </DialogDescription>
              </DialogHeader>

              <div className="flex flex-col gap-3">
                {batch.map((platform) => (
                  <PublishProgressCard
                    key={`${platform}-${retryTick[platform] ?? 0}`}
                    platform={platform}
                    result={results[platform]}
                    onRetry={() => handleRetry(platform)}
                  />
                ))}
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setOpen(false)}
                >
                  Close
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}

function PublishProgressCard({
  platform,
  result,
  onRetry,
}: {
  platform: Platform
  result?: ResultState
  onRetry: () => void
}) {
  const Icon = PLATFORM_ICONS[platform]
  const status = result?.status ?? "pending"
  const [progress, setProgress] = useState(10)

  useEffect(() => {
    if (status !== "pending" && status !== "publishing") return
    const interval = setInterval(() => {
      setProgress((prev) => (prev >= 90 ? 90 : prev + Math.random() * 15))
    }, 400)
    return () => clearInterval(interval)
  }, [status])

  const displayProgress = status === "success" || status === "failed" ? 100 : progress

  return (
    <Card size="sm">
      <CardContent className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Icon className="size-4 text-muted-foreground" />
            <span className="text-sm font-medium">
              {platformLabels[platform]}
            </span>
          </div>
          <StatusBadge status={status} />
        </div>
        <Progress value={displayProgress} />
        {status === "failed" && (
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs text-destructive">{result?.error}</p>
            <Button type="button" size="xs" variant="outline" onClick={onRetry}>
              Retry
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function StatusBadge({ status }: { status: ResultState["status"] }) {
  switch (status) {
    case "success":
      return (
        <Badge className="gap-1 bg-green-500/10 text-green-600 dark:bg-green-500/15 dark:text-green-400">
          <CheckCircle2 className="size-3" />
          Success
        </Badge>
      )
    case "failed":
      return (
        <Badge variant="destructive" className="gap-1">
          <XCircle className="size-3" />
          Failed
        </Badge>
      )
    case "publishing":
      return (
        <Badge variant="outline" className="gap-1">
          <Loader2 className="size-3 animate-spin" />
          Publishing
        </Badge>
      )
    default:
      return <Badge variant="outline">Pending</Badge>
  }
}
