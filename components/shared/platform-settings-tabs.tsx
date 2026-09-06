"use client"

import { useCallback, useState } from "react"
import { PlaySquare, Music2, Camera, ThumbsUp } from "lucide-react"
import type { Platform, PlatformSettings } from "@prisma/client"

import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { PlatformSettingsForm } from "@/components/shared/platform-settings-form"
import type { SourceDimensions } from "@/components/shared/video-workspace"

const PLATFORM_TABS: {
  key: Platform
  label: string
  icon: React.ComponentType<{ className?: string }>
}[] = [
  { key: "YOUTUBE", label: "YouTube", icon: PlaySquare },
  { key: "TIKTOK", label: "TikTok", icon: Music2 },
  { key: "INSTAGRAM", label: "Instagram", icon: Camera },
  { key: "FACEBOOK", label: "Facebook", icon: ThumbsUp },
]

export function PlatformSettingsTabs({
  videoId,
  settingsByPlatform,
  sourceDimensions,
}: {
  videoId: string
  settingsByPlatform: Record<Platform, PlatformSettings | null>
  sourceDimensions: SourceDimensions | null
}) {
  const [dirty, setDirty] = useState<Record<Platform, boolean>>({
    YOUTUBE: false,
    TIKTOK: false,
    INSTAGRAM: false,
    FACEBOOK: false,
  })

  // Bail out when the value hasn't actually changed so the parent doesn't
  // re-render every time a child's dirty-tracking effect re-fires — without
  // this, a new object each call feeds back into the child's effect deps
  // and loops forever.
  const handleDirtyChange = useCallback((platform: Platform, isDirty: boolean) => {
    setDirty((prev) =>
      prev[platform] === isDirty ? prev : { ...prev, [platform]: isDirty }
    )
  }, [])

  return (
    <Tabs defaultValue="YOUTUBE" className="w-full">
      <div className="-mx-1 overflow-x-auto px-1">
        <TabsList className="w-max">
          {PLATFORM_TABS.map(({ key, label, icon: Icon }) => (
            <TabsTrigger key={key} value={key} className="gap-1.5">
              <Icon className="size-4" />
              {label}
              {dirty[key] && (
                <span
                  className="ml-0.5 size-1.5 shrink-0 rounded-full bg-primary"
                  aria-label="Unsaved changes"
                />
              )}
            </TabsTrigger>
          ))}
        </TabsList>
      </div>
      {PLATFORM_TABS.map(({ key }) => (
        <TabsContent
          key={key}
          value={key}
          forceMount
          className="mt-4 data-[state=inactive]:hidden"
        >
          <PlatformSettingsForm
            videoId={videoId}
            platform={key}
            initialData={settingsByPlatform[key]}
            sourceDimensions={sourceDimensions}
            onDirtyChange={(isDirty) => handleDirtyChange(key, isDirty)}
          />
        </TabsContent>
      ))}
    </Tabs>
  )
}
