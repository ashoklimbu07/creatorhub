"use client"

import { useCallback, useRef, useState } from "react"
import type { Platform, PlatformSettings } from "@prisma/client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { PlatformSettingsTabs } from "@/components/shared/platform-settings-tabs"
import { saveVideoDimensions } from "@/app/(dashboard)/dashboard/drafts/[id]/actions"

export type SourceDimensions = { width: number; height: number }

export function VideoWorkspace({
  videoId,
  videoUrl,
  settingsByPlatform,
  initialDimensions,
}: {
  videoId: string
  videoUrl: string
  settingsByPlatform: Record<Platform, PlatformSettings | null>
  initialDimensions: SourceDimensions | null
}) {
  const [sourceDimensions, setSourceDimensions] = useState<SourceDimensions | null>(
    initialDimensions
  )
  // Older drafts uploaded before dimensions were captured at upload time
  // have no stored width/height — detect from the player once and persist
  // it so this doesn't need to re-detect (or leave the server blind to it)
  // on every future load.
  const backfilled = useRef(initialDimensions !== null)

  const handleLoadedMetadata = useCallback(
    (e: React.SyntheticEvent<HTMLVideoElement>) => {
      if (backfilled.current) return
      const { videoWidth, videoHeight } = e.currentTarget
      if (!videoWidth || !videoHeight) return

      backfilled.current = true
      setSourceDimensions({ width: videoWidth, height: videoHeight })
      saveVideoDimensions(videoId, videoWidth, videoHeight).catch(() => {
        backfilled.current = false
      })
    },
    [videoId]
  )

  return (
    <>
      <Card className="overflow-hidden py-0">
        <video
          src={videoUrl}
          controls
          onLoadedMetadata={handleLoadedMetadata}
          className="aspect-video w-full bg-black"
        />
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Platform settings</CardTitle>
        </CardHeader>
        <CardContent>
          <PlatformSettingsTabs
            videoId={videoId}
            settingsByPlatform={settingsByPlatform}
            sourceDimensions={sourceDimensions}
          />
        </CardContent>
      </Card>
    </>
  )
}
