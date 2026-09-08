"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import type { Platform, VideoStatus } from "@prisma/client"
import {
  AlertCircle,
  CalendarClock,
  Camera,
  Check,
  CheckCircle2,
  FilePenLine,
  Layers3,
  Loader2,
  Music2,
  PlaySquare,
  Send,
  ThumbsUp,
  XCircle,
} from "lucide-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Progress } from "@/components/ui/progress"
import { SchedulePicker } from "@/components/shared/schedule-picker"
import { DeleteDraftButton } from "@/components/shared/delete-draft-button"
import { VideoStatusBadge } from "@/components/shared/video-status-badge"
import { platformLabels } from "@/lib/validations/platform-settings"
import {
  configureBulkPublish,
  publishPlatform,
} from "@/app/(dashboard)/dashboard/drafts/[id]/actions"

const MAX_BULK_PUBLISH = 10
const PARALLEL_VIDEOS = 3

const PLATFORM_ICONS: Record<
  Platform,
  React.ComponentType<{ className?: string }>
> = {
  YOUTUBE: PlaySquare,
  TIKTOK: Music2,
  INSTAGRAM: Camera,
  FACEBOOK: ThumbsUp,
}

export type PublishableDraft = {
  id: string
  videoId: string
  title: string
  status: VideoStatus
  lastEditedLabel: string
  sizeLabel: string | null
  previewUrl: string
  previewType: "image" | "video"
  completePlatforms: Platform[]
  readyPlatforms: Platform[]
  scheduledLabel: string | null
}

type VideoResult = {
  status: "waiting" | "publishing" | "published" | "partial" | "scheduled" | "failed"
  detail?: string
}

export function BulkPublishDrafts({ drafts }: { drafts: PublishableDraft[] }) {
  const router = useRouter()
  const [selectionMode, setSelectionMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [platformsByDraft, setPlatformsByDraft] = useState<Record<string, Platform[]>>({})
  const [scheduleByDraft, setScheduleByDraft] = useState<Record<string, Date | null>>({})
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [dialogOpen, setDialogOpen] = useState(false)
  const [activeBatch, setActiveBatch] = useState<PublishableDraft[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [finishedCount, setFinishedCount] = useState(0)
  const [results, setResults] = useState<Record<string, VideoResult>>({})

  const selectedDrafts = drafts.filter((draft) => selectedIds.has(draft.id))

  function beginSelection() {
    setSelectionMode(true)
    setErrors({})
  }

  function cancelSelection() {
    setSelectionMode(false)
    setSelectedIds(new Set())
    setPlatformsByDraft({})
    setScheduleByDraft({})
    setErrors({})
  }

  function toggleDraft(draft: PublishableDraft) {
    if (draft.readyPlatforms.length === 0) return
    setSelectedIds((current) => {
      const next = new Set(current)
      if (next.has(draft.id)) {
        next.delete(draft.id)
      } else {
        if (next.size >= MAX_BULK_PUBLISH) {
          toast.error(`You can publish up to ${MAX_BULK_PUBLISH} videos in one batch.`)
          return current
        }
        next.add(draft.id)
        setPlatformsByDraft((values) => ({
          ...values,
          [draft.id]: draft.readyPlatforms,
        }))
        setScheduleByDraft((values) => ({ ...values, [draft.id]: null }))
      }
      return next
    })
  }

  function togglePlatform(draftId: string, platform: Platform) {
    setPlatformsByDraft((current) => {
      const selected = current[draftId] ?? []
      return {
        ...current,
        [draftId]: selected.includes(platform)
          ? selected.filter((value) => value !== platform)
          : [...selected, platform],
      }
    })
    setErrors((current) => {
      const next = { ...current }
      delete next[draftId]
      return next
    })
  }

  function continueToSchedule() {
    if (selectedDrafts.length === 0) {
      toast.error("Select at least one draft to publish.")
      return
    }
    const missing = selectedDrafts.filter(
      (draft) => (platformsByDraft[draft.id] ?? []).length === 0
    )
    if (missing.length > 0) {
      setErrors(
        Object.fromEntries(
          missing.map((draft) => [draft.id, "Select at least one social platform."])
        )
      )
      toast.error("Every selected video needs at least one social platform.")
      return
    }
    setActiveBatch(selectedDrafts)
    setResults({})
    setFinishedCount(0)
    setDialogOpen(true)
  }

  async function processVideo(draft: PublishableDraft): Promise<VideoResult["status"]> {
    const platforms = platformsByDraft[draft.id] ?? []
    const scheduledAt = scheduleByDraft[draft.id] ?? null
    setResults((current) => ({
      ...current,
      [draft.id]: { status: scheduledAt ? "waiting" : "publishing" },
    }))

    try {
      const configured = await configureBulkPublish(
        draft.videoId,
        platforms,
        scheduledAt?.toISOString() ?? null
      )

      if (configured.scheduled) {
        setResults((current) => ({
          ...current,
          [draft.id]: {
            status: "scheduled",
            detail: `Scheduled for ${scheduledAt!.toLocaleString()}`,
          },
        }))
        return "scheduled"
      }

      const platformResults = await Promise.all(
        platforms.map(async (platform) => {
          try {
            return await publishPlatform(draft.videoId, platform, platforms)
          } catch {
            return { platform, success: false, error: "Unexpected publishing error." }
          }
        })
      )
      const successes = platformResults.filter((result) => result.success).length
      const status =
        successes === platforms.length
          ? "published"
          : successes > 0
            ? "partial"
            : "failed"
      const detail = `${successes}/${platforms.length} platforms published`
      setResults((current) => ({ ...current, [draft.id]: { status, detail } }))
      return status
    } catch (error) {
      setResults((current) => ({
        ...current,
        [draft.id]: {
          status: "failed",
          detail: error instanceof Error ? error.message : "Publishing failed.",
        },
      }))
      return "failed"
    } finally {
      setFinishedCount((current) => current + 1)
    }
  }

  async function publishBatch() {
    const invalidSchedule = activeBatch.find((draft) => {
      const value = scheduleByDraft[draft.id]
      return value && value.getTime() <= Date.now()
    })
    if (invalidSchedule) {
      setErrors((current) => ({
        ...current,
        [invalidSchedule.id]: "Choose a future date and time.",
      }))
      toast.error("Scheduled times must be in the future.")
      return
    }

    setIsProcessing(true)
    setFinishedCount(0)
    setResults(
      Object.fromEntries(
        activeBatch.map((draft) => [draft.id, { status: "waiting" as const }])
      )
    )
    let nextIndex = 0
    const outcomes: VideoResult["status"][] = []

    async function processNext() {
      while (nextIndex < activeBatch.length) {
        const draft = activeBatch[nextIndex]
        nextIndex += 1
        outcomes.push(await processVideo(draft))
      }
    }

    await Promise.all(
      Array.from(
        { length: Math.min(PARALLEL_VIDEOS, activeBatch.length) },
        () => processNext()
      )
    )
    setIsProcessing(false)

    const published = outcomes.filter((value) => value === "published").length
    const scheduled = outcomes.filter((value) => value === "scheduled").length
    const partial = outcomes.filter((value) => value === "partial").length
    if (published + scheduled === activeBatch.length) {
      toast.success("Bulk publish completed", {
        description: `${published} published now · ${scheduled} scheduled`,
      })
    } else if (published + scheduled + partial > 0) {
      toast.warning("Bulk publish finished with some failures.")
    } else {
      toast.error("The selected videos could not be published.")
    }
    router.refresh()
  }

  function handleDialogOpenChange(open: boolean) {
    if (isProcessing) return
    setDialogOpen(open)
    if (!open && Object.keys(results).length > 0) cancelSelection()
  }

  return (
    <>
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          {selectionMode ? (
            <p className="text-sm text-muted-foreground">
              {selectedDrafts.length} of {MAX_BULK_PUBLISH} videos selected
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">
              Platform badges show settings that are complete and saved.
            </p>
          )}
          <div className="flex gap-2">
            {selectionMode ? (
              <>
                <Button type="button" variant="outline" onClick={cancelSelection}>
                  Cancel
                </Button>
                <Button type="button" onClick={continueToSchedule} disabled={selectedDrafts.length === 0}>
                  Continue ({selectedDrafts.length})
                </Button>
              </>
            ) : (
              <Button type="button" onClick={beginSelection}>
                <Layers3 />
                Publish bulk videos
              </Button>
            )}
          </div>
        </div>

        {drafts.map((draft) => {
          const selected = selectedIds.has(draft.id)
          const canSelect =
            draft.readyPlatforms.length > 0 &&
            draft.status !== "PUBLISHING" &&
            draft.status !== "PUBLISHED" &&
            draft.status !== "READY"
          return (
            <Card key={draft.id} className={selected ? "border-primary bg-primary/5" : ""}>
              <CardContent className="flex flex-col gap-4 px-4 py-4 sm:flex-row sm:items-center">
                {selectionMode && (
                  <input
                    type="checkbox"
                    checked={selected}
                    onChange={() => toggleDraft(draft)}
                    disabled={!canSelect}
                    aria-label={`Select ${draft.title}`}
                    className="size-4 shrink-0 accent-primary"
                  />
                )}
                <div className="flex h-16 w-28 shrink-0 items-center justify-center rounded-md bg-muted">
                  {draft.previewType === "image" ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={draft.previewUrl} alt={draft.title} className="size-full rounded-md object-cover" />
                  ) : (
                    <video src={draft.previewUrl} muted playsInline preload="metadata" aria-label={`${draft.title} preview`} className="size-full rounded-md object-cover" />
                  )}
                </div>

                <div className="min-w-0 flex flex-1 flex-col gap-1.5">
                  <p className="truncate font-medium">{draft.title}</p>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <VideoStatusBadge status={draft.status} />
                    <span>Last edited {draft.lastEditedLabel}</span>
                    {draft.sizeLabel && <span>{draft.sizeLabel}</span>}
                  </div>
                  <SavedPlatformBadges draft={draft} />
                  {draft.scheduledLabel && (
                    <p className="flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400">
                      <CalendarClock className="size-3.5" /> Scheduled for {draft.scheduledLabel}
                    </p>
                  )}
                  {selectionMode && selected && (
                    <div className="mt-2 space-y-1.5 rounded-lg border bg-background p-3">
                      <p className="text-xs font-medium">Publish this video to</p>
                      <div className="flex flex-wrap gap-2">
                        {draft.readyPlatforms.map((platform) => {
                          const Icon = PLATFORM_ICONS[platform]
                          const active = (platformsByDraft[draft.id] ?? []).includes(platform)
                          return (
                            <Button
                              key={platform}
                              type="button"
                              size="sm"
                              variant={active ? "default" : "outline"}
                              aria-pressed={active}
                              onClick={() => togglePlatform(draft.id, platform)}
                            >
                              <Icon /> {platformLabels[platform]} {active && <Check />}
                            </Button>
                          )
                        })}
                      </div>
                      {errors[draft.id] && (
                        <p className="flex items-center gap-1 text-xs text-destructive">
                          <AlertCircle className="size-3.5" /> {errors[draft.id]}
                        </p>
                      )}
                    </div>
                  )}
                </div>

                {!selectionMode && (
                  <div className="flex shrink-0 gap-2">
                    <Button asChild size="sm">
                      <Link href={`/dashboard/drafts/${draft.id}`}><FilePenLine /> Edit</Link>
                    </Button>
                    <DeleteDraftButton videoId={draft.videoId} />
                  </div>
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>

      <Dialog open={dialogOpen} onOpenChange={handleDialogOpenChange}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{isProcessing ? "Bulk publishing…" : "Schedule and publish"}</DialogTitle>
            <DialogDescription>
              {isProcessing
                ? `${finishedCount} of ${activeBatch.length} videos finished. Keep this page open.`
                : "Choose when each video should publish. Leave the schedule empty to publish immediately."}
            </DialogDescription>
          </DialogHeader>

          {isProcessing && (
            <Progress value={activeBatch.length ? (finishedCount / activeBatch.length) * 100 : 0} />
          )}

          <div className="max-h-[60vh] space-y-3 overflow-y-auto pr-1">
            {activeBatch.map((draft) => (
              <div key={draft.id} className="space-y-2 rounded-xl border p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{draft.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {(platformsByDraft[draft.id] ?? []).map((platform) => platformLabels[platform]).join(", ")}
                    </p>
                  </div>
                  <ResultBadge result={results[draft.id]} />
                </div>
                {!isProcessing && !results[draft.id] && (
                  <div>
                    <p className="mb-1.5 flex items-center gap-1 text-xs font-medium">
                      <CalendarClock className="size-3.5" /> Schedule (optional)
                    </p>
                    <SchedulePicker
                      value={scheduleByDraft[draft.id] ?? null}
                      onChange={(date) => {
                        setScheduleByDraft((current) => ({ ...current, [draft.id]: date }))
                        setErrors((current) => {
                          const next = { ...current }
                          delete next[draft.id]
                          return next
                        })
                      }}
                    />
                    {errors[draft.id] && <p className="mt-1 text-xs text-destructive">{errors[draft.id]}</p>}
                  </div>
                )}
                {results[draft.id]?.detail && (
                  <p className="text-xs text-muted-foreground">{results[draft.id].detail}</p>
                )}
              </div>
            ))}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} disabled={isProcessing}>
              {Object.keys(results).length > 0 && !isProcessing ? "Close" : "Cancel"}
            </Button>
            {!isProcessing && Object.keys(results).length === 0 && (
              <Button type="button" onClick={publishBatch}><Send /> Publish / schedule all</Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

function SavedPlatformBadges({ draft }: { draft: PublishableDraft }) {
  if (draft.completePlatforms.length === 0) {
    return <p className="text-xs text-amber-600 dark:text-amber-400">No social platform settings are complete</p>
  }
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="text-xs text-muted-foreground">Saved for:</span>
      {draft.completePlatforms.map((platform) => {
        const Icon = PLATFORM_ICONS[platform]
        const connected = draft.readyPlatforms.includes(platform)
        return (
          <Badge key={platform} variant={connected ? "secondary" : "outline"} title={connected ? "Ready to publish" : "Account not connected"}>
            <Icon /> {platformLabels[platform]} {connected && <CheckCircle2 />}
          </Badge>
        )
      })}
    </div>
  )
}

function ResultBadge({ result }: { result?: VideoResult }) {
  if (!result) return null
  if (result.status === "publishing") return <Badge variant="outline"><Loader2 className="animate-spin" /> Publishing</Badge>
  if (result.status === "waiting") return <Badge variant="outline">Waiting</Badge>
  if (result.status === "published") return <Badge className="bg-emerald-600 text-white"><CheckCircle2 /> Published</Badge>
  if (result.status === "scheduled") return <Badge className="bg-blue-600 text-white"><CalendarClock /> Scheduled</Badge>
  if (result.status === "partial") return <Badge className="bg-amber-500 text-white"><AlertCircle /> Partial</Badge>
  return <Badge variant="destructive"><XCircle /> Failed</Badge>
}
