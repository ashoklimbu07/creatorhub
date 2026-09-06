"use client"

import { useEffect, useMemo, useTransition } from "react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "sonner"
import { Check } from "lucide-react"
import type { Platform, PlatformSettings } from "@prisma/client"

import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { TagInput } from "@/components/shared/tag-input"
import { SchedulePicker } from "@/components/shared/schedule-picker"
import type { SourceDimensions } from "@/components/shared/video-workspace"
import { cn } from "@/lib/utils"
import { matchAspectRatio, formatRawRatio } from "@/lib/aspect-ratio"
import {
  platformSettingsSchemaFor,
  platformLabels,
  hashtagsFieldLabel,
  privacyLimitationNote,
  PLATFORMS_WITH_DESCRIPTION,
  aspectRatiosByPlatform,
  type PlatformSettingsInput,
} from "@/lib/validations/platform-settings"
import { savePlatformSettings } from "@/app/(dashboard)/dashboard/drafts/[id]/actions"

export function PlatformSettingsForm({
  videoId,
  platform,
  initialData,
  sourceDimensions,
  onDirtyChange,
}: {
  videoId: string
  platform: Platform
  initialData: PlatformSettings | null
  sourceDimensions: SourceDimensions | null
  onDirtyChange: (dirty: boolean) => void
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const supportsDescription = PLATFORMS_WITH_DESCRIPTION.includes(platform)
  const supportedAspectRatios = aspectRatiosByPlatform[platform]

  // We don't crop/convert video — whatever ratio the source file actually is
  // is what gets published, so this is a detect-and-flag check, not a
  // picker. matchAspectRatio returns null when the source doesn't cleanly
  // match any known label (see lib/aspect-ratio.ts for the tolerance).
  const detectedRatio = useMemo(
    () =>
      sourceDimensions
        ? matchAspectRatio(sourceDimensions.width, sourceDimensions.height)
        : undefined, // undefined = still detecting, null = detected but unmatched
    [sourceDimensions]
  )
  const rawRatioLabel = sourceDimensions
    ? formatRawRatio(sourceDimensions.width, sourceDimensions.height)
    : null
  const isDetecting = detectedRatio === undefined
  const matchesPlatform =
    detectedRatio != null && supportedAspectRatios.includes(detectedRatio)

  function handleUnsupportedClick() {
    toast.error(
      detectedRatio
        ? `Your video is ${detectedRatio} — CreatorHub doesn't crop or convert video, so it can only publish in that original ratio.`
        : `Your video is ${rawRatioLabel} — CreatorHub doesn't crop or convert video, so it can only publish in that original ratio.`
    )
  }

  const form = useForm<PlatformSettingsInput>({
    resolver: zodResolver(platformSettingsSchemaFor(platform)),
    defaultValues: {
      title: initialData?.title ?? "",
      caption: initialData?.caption ?? "",
      description: initialData?.description ?? "",
      hashtags: initialData?.hashtags ?? [],
      containsAltered: initialData?.containsAltered ?? false,
      privacy: initialData?.privacy ?? "PUBLIC",
      scheduledAt: initialData?.scheduledAt ?? null,
    },
  })

  const { isDirty } = form.formState

  useEffect(() => {
    onDirtyChange(isDirty)
  }, [isDirty, onDirtyChange])

  function onSubmit(data: PlatformSettingsInput) {
    startTransition(async () => {
      try {
        await savePlatformSettings(videoId, platform, data)
        form.reset(data)
        toast.success(`${platformLabels[platform]} settings saved`)
        router.refresh()
      } catch {
        toast.error(`Failed to save ${platformLabels[platform]} settings`)
      }
    })
  }

  function onInvalid(errors: typeof form.formState.errors) {
    const firstMessage = Object.values(errors)[0]?.message
    toast.error(
      typeof firstMessage === "string"
        ? firstMessage
        : `Fix the highlighted fields before saving ${platformLabels[platform]}`
    )
  }

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit, onInvalid)}
        className="flex flex-col gap-4"
      >
        <div className="flex flex-col gap-2 rounded-lg border bg-muted/30 p-3">
          <div className="flex flex-col gap-0.5 sm:flex-row sm:items-center sm:justify-between">
            <Label>Aspect ratio</Label>
            <span className="text-xs text-muted-foreground">
              {isDetecting
                ? "Detecting your video…"
                : detectedRatio
                  ? `Your video is ${detectedRatio}`
                  : `Your video is ${rawRatioLabel} — doesn't match a standard ratio`}
            </span>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {supportedAspectRatios.map((ratio) => {
              const isMatch = ratio === detectedRatio
              return (
                <button
                  key={ratio}
                  type="button"
                  disabled={isDetecting}
                  aria-pressed={isMatch}
                  onClick={isMatch ? undefined : handleUnsupportedClick}
                  className={cn(
                    "flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium transition-colors",
                    isDetecting
                      ? "border-border text-muted-foreground/50"
                      : isMatch
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border text-muted-foreground/60 hover:bg-muted"
                  )}
                >
                  <span
                    className="block w-2.5 shrink-0 rounded-[1.5px] border-[1.5px] border-current"
                    style={{ aspectRatio: ratio.replace(":", " / ") }}
                  />
                  {ratio}
                  {isMatch && <Check className="size-3" />}
                </button>
              )
            })}
          </div>

          {!isDetecting && !matchesPlatform && (
            <p className="text-xs text-destructive">
              {detectedRatio
                ? `${detectedRatio} isn't in ${platformLabels[platform]}'s supported list — publishing will use the original file as-is.`
                : `CreatorHub doesn't crop or convert video — publishing will use the original ${rawRatioLabel} file as-is.`}
            </p>
          )}
        </div>

        <FormField
          control={form.control}
          name="title"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Title</FormLabel>
              <FormControl>
                <Input placeholder="Video title" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {supportsDescription ? (
          <FormField
            control={form.control}
            name="description"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Description</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="Add a longer description…"
                    className="min-h-24"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        ) : (
          <FormField
            control={form.control}
            name="caption"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Caption</FormLabel>
                <FormControl>
                  <Textarea placeholder="Write a caption…" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        <FormField
          control={form.control}
          name="hashtags"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{hashtagsFieldLabel[platform]}</FormLabel>
              <FormControl>
                <TagInput
                  value={field.value}
                  onChange={field.onChange}
                  hashPrefix={!supportsDescription}
                  placeholder={
                    supportsDescription
                      ? "Add a tag and press Enter"
                      : "Add a hashtag and press Enter"
                  }
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="containsAltered"
          render={({ field }) => (
            <FormItem>
              <div className="flex items-center justify-between gap-4 rounded-lg border p-3">
                <div className="space-y-0.5">
                  <FormLabel>Altered or synthetic content</FormLabel>
                  <p className="text-xs text-muted-foreground">
                    Tell viewers when this video contains realistic altered or
                    synthetic content, like AI-generated media.
                  </p>
                </div>
                <FormControl>
                  <Switch
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                </FormControl>
              </div>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="privacy"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Privacy</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="PUBLIC">Public</SelectItem>
                    <SelectItem value="UNLISTED">Unlisted</SelectItem>
                    <SelectItem value="PRIVATE">Private</SelectItem>
                  </SelectContent>
                </Select>
                {privacyLimitationNote[platform] && (
                  <p className="text-xs text-muted-foreground">
                    {privacyLimitationNote[platform]}
                  </p>
                )}
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="scheduledAt"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Schedule (optional)</FormLabel>
                <SchedulePicker value={field.value} onChange={field.onChange} />
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="flex items-center gap-3 border-t pt-4">
          <Button type="submit" size="sm" disabled={isPending || !isDirty}>
            {isPending ? "Saving…" : "Save"}
          </Button>
          <span className="text-xs text-muted-foreground">
            {isPending
              ? "Saving…"
              : isDirty
                ? "Unsaved changes"
                : initialData
                  ? "Saved"
                  : "Not saved yet"}
          </span>
        </div>
      </form>
    </Form>
  )
}
