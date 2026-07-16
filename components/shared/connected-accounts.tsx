"use client"

import { useEffect, useState } from "react"
import { PlaySquare, Music2, Camera, ThumbsUp } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

type PlatformKey = "YOUTUBE" | "TIKTOK" | "INSTAGRAM" | "FACEBOOK"

const platforms: {
  key: PlatformKey
  label: string
  icon: React.ComponentType<{ className?: string }>
}[] = [
  { key: "YOUTUBE", label: "YouTube", icon: PlaySquare },
  { key: "TIKTOK", label: "TikTok", icon: Music2 },
  { key: "INSTAGRAM", label: "Instagram", icon: Camera },
  { key: "FACEBOOK", label: "Facebook", icon: ThumbsUp },
]

export function ConnectedAccounts() {
  const [loading, setLoading] = useState(true)
  const [connected, setConnected] = useState<Record<PlatformKey, boolean>>({
    YOUTUBE: false,
    TIKTOK: false,
    INSTAGRAM: false,
    FACEBOOK: false,
  })

  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 600)
    return () => clearTimeout(timer)
  }, [])

  function toggle(key: PlatformKey) {
    setConnected((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  if (loading) {
    return (
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-28 rounded-xl" />
        ))}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
      {platforms.map(({ key, label, icon: Icon }) => {
        const isConnected = connected[key]
        return (
          <Card key={key}>
            <CardContent className="flex flex-col items-center gap-3 px-4 py-5 text-center">
              <Icon
                className={cn(
                  "size-6",
                  isConnected ? "text-primary" : "text-muted-foreground"
                )}
              />
              <div>
                <p className="text-sm font-medium">{label}</p>
                <p className="text-xs text-muted-foreground">
                  {isConnected ? "Connected" : "Not connected"}
                </p>
              </div>
              <Button
                type="button"
                size="sm"
                variant={isConnected ? "outline" : "default"}
                className="w-full"
                onClick={() => toggle(key)}
              >
                {isConnected ? "Disconnect" : "Connect"}
              </Button>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
