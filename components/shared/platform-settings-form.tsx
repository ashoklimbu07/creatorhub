"use client"

import { useEffect, useTransition } from "react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "sonner"
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { TagInput } from "@/components/shared/tag-input"
import { SchedulePicker } from "@/components/shared/schedule-picker"
import {
  platformSettingsSchema,
  platformLabels,
  PLATFORMS_WITH_DESCRIPTION,
  type PlatformSettingsInput,
} from "@/lib/validations/platform-settings"
import { savePlatformSettings } from "@/app/(dashboard)/dashboard/drafts/[id]/actions"

export function PlatformSettingsForm({
  videoId,
  platform,
  initialData,
  onDirtyChange,
}: {
  videoId: string
  platform: Platform
  initialData: PlatformSettings | null
  onDirtyChange: (dirty: boolean) => void
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const supportsDescription = PLATFORMS_WITH_DESCRIPTION.includes(platform)

  const form = useForm<PlatformSettingsInput>({
    resolver: zodResolver(platformSettingsSchema),
    defaultValues: {
      title: initialData?.title ?? "",
      caption: initialData?.caption ?? "",
      description: initialData?.description ?? "",
      hashtags: initialData?.hashtags ?? [],
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

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="flex flex-col gap-4"
      >
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
          <div>
            <p className="text-sm font-medium">Description</p>
            <p className="text-xs text-muted-foreground">
              {platformLabels[platform]} doesn&apos;t support a separate
              description — use the caption instead.
            </p>
          </div>
        )}

        <FormField
          control={form.control}
          name="hashtags"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Hashtags</FormLabel>
              <FormControl>
                <TagInput value={field.value} onChange={field.onChange} />
              </FormControl>
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
