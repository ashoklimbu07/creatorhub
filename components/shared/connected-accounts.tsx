"use client"

import { useEffect, useTransition } from "react"
import { useRouter } from "next/navigation"
import { PlaySquare, Music2, Camera, ThumbsUp } from "lucide-react"
import { toast } from "sonner"
import type { Platform } from "@prisma/client"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import {
  connectPlatform,
  disconnectPlatform,
} from "@/app/(dashboard)/dashboard/accounts/actions"

const platforms: {
  key: Platform
  label: string
  icon: React.ComponentType<{ className?: string }>
}[] = [
  { key: "YOUTUBE", label: "YouTube", icon: PlaySquare },
  { key: "TIKTOK", label: "TikTok", icon: Music2 },
  { key: "INSTAGRAM", label: "Instagram", icon: Camera },
  { key: "FACEBOOK", label: "Facebook", icon: ThumbsUp },
]

function platformLabel(key: string) {
  return platforms.find((p) => p.key === key)?.label ?? key
}

export function ConnectedAccounts({
  initialConnected,
  callbackConnected,
  callbackError,
}: {
  initialConnected: Platform[]
  callbackConnected?: string
  callbackError?: string
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const connectedSet = new Set(initialConnected)

  useEffect(() => {
    if (callbackConnected) {
      toast.success(`${platformLabel(callbackConnected)} connected`)
      router.replace("/dashboard/accounts")
    } else if (callbackError) {
      toast.error("Couldn't connect that account. Please try again.")
      router.replace("/dashboard/accounts")
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [callbackConnected, callbackError])

  function handleConnect(platform: Platform) {
    startTransition(async () => {
      await connectPlatform(platform)
    })
  }

  function handleDisconnect(platform: Platform) {
    startTransition(async () => {
      try {
        await disconnectPlatform(platform)
        toast.success(`${platformLabel(platform)} disconnected`)
        router.refresh()
      } catch {
        toast.error("Failed to disconnect")
      }
    })
  }

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
      {platforms.map(({ key, label, icon: Icon }) => {
        const isConnected = connectedSet.has(key)
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
                disabled={isPending}
                onClick={() =>
                  isConnected ? handleDisconnect(key) : handleConnect(key)
                }
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
