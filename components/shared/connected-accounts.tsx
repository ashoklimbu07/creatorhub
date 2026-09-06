"use client"

import { useEffect, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { PlaySquare, Music2, Camera, ThumbsUp, LoaderCircle } from "lucide-react"
import { toast } from "sonner"
import type { Platform } from "@prisma/client"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import {
  connectPlatform,
  disconnectPlatform,
  connectFacebookPages,
  disconnectFacebookPage,
  setDefaultFacebookPage,
} from "@/app/(dashboard)/dashboard/accounts/actions"

const platforms: {
  key: Exclude<Platform, "FACEBOOK">
  label: string
  icon: React.ComponentType<{ className?: string }>
}[] = [
  { key: "YOUTUBE", label: "YouTube", icon: PlaySquare },
  { key: "TIKTOK", label: "TikTok", icon: Music2 },
  { key: "INSTAGRAM", label: "Instagram", icon: Camera },
]

// Platforms with a real OAuth connect flow link straight to their own
// `/api/platforms/{platform}/connect` route (same pattern as YouTube in
// Phase 4) instead of the generic connectPlatform server action — TikTok
// stays on the mock flow until Phase 6.
const REAL_PLATFORMS = new Set<Platform>(["YOUTUBE", "INSTAGRAM", "FACEBOOK"])

function platformLabel(key: string) {
  if (key === "FACEBOOK") return "Facebook"
  return platforms.find((p) => p.key === key)?.label ?? key
}

function ActionLabel({ loading, idle, busy }: { loading: boolean; idle: string; busy: string }) {
  return (
    <>
      {loading && <LoaderCircle className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />}
      <span aria-live="polite">{loading ? busy : idle}</span>
    </>
  )
}

export type PlatformConnectionInfo = {
  name: string
  thumbnailUrl: string | null
}

export type FacebookPageConnectionInfo = {
  id: string
  name: string
  thumbnailUrl: string | null
  isDefault: boolean
}

export type PendingFacebookPage = {
  id: string
  name: string
  picture: string | null
  alreadyConnected: boolean
}

export function ConnectedAccounts({
  initialConnected,
  connections,
  facebookConnections = [],
  pendingFacebookPages,
  manageFacebook = false,
  callbackConnected,
  callbackError,
}: {
  initialConnected: Platform[]
  connections?: Partial<Record<Exclude<Platform, "FACEBOOK">, PlatformConnectionInfo>>
  facebookConnections?: FacebookPageConnectionInfo[]
  pendingFacebookPages?: PendingFacebookPage[] | null
  manageFacebook?: boolean
  callbackConnected?: string
  callbackError?: string
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [activeAction, setActiveAction] = useState<string | null>(null)
  const [connectingPlatform, setConnectingPlatform] = useState<Platform | null>(null)
  const isBusy = isPending || connectingPlatform !== null
  const [selectedPageIds, setSelectedPageIds] = useState<string[]>([])
  const connectedSet = new Set(initialConnected)

  const defaultFacebookPage =
    facebookConnections.find((p) => p.isDefault) ?? facebookConnections[0] ?? null

  useEffect(() => {
    // Restore usable controls when Back returns from an OAuth provider via
    // the browser's page cache.
    const resetNavigation = () => setConnectingPlatform(null)
    window.addEventListener("pageshow", resetNavigation)
    return () => window.removeEventListener("pageshow", resetNavigation)
  }, [])

  function handleOAuthConnect(platform: Platform) {
    setConnectingPlatform(platform)
    window.location.assign(`/api/platforms/${platform.toLowerCase()}/connect`)
  }

  useEffect(() => {
    if (callbackConnected) {
      toast.success(`${platformLabel(callbackConnected)} connected`)
      router.replace("/dashboard/accounts")
    } else if (callbackError === "FACEBOOK_NO_PAGES") {
      toast.error(
        "No Facebook Pages found for that login. Make sure you're an admin of the Page, and — while the app is in Development Mode — that your Facebook account is added under App Roles (Admin/Developer/Tester) in the Meta App Dashboard.",
        { duration: 12000 }
      )
      router.replace("/dashboard/accounts")
    } else if (callbackError) {
      toast.error("Couldn't connect that account. Please try again.")
      router.replace("/dashboard/accounts")
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [callbackConnected, callbackError])

  function handleConnect(platform: Exclude<Platform, "FACEBOOK">) {
    setActiveAction(`connect:${platform}`)
    startTransition(async () => {
      await connectPlatform(platform)
    })
  }

  function handleDisconnect(platform: Exclude<Platform, "FACEBOOK">) {
    setActiveAction(`disconnect:${platform}`)
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

  function toggleSelectedPage(pageId: string) {
    setSelectedPageIds((current) =>
      current.includes(pageId) ? current.filter((id) => id !== pageId) : [...current, pageId]
    )
  }

  function handleConnectSelectedPages() {
    setActiveAction("connect:pages")
    startTransition(async () => {
      try {
        await connectFacebookPages(selectedPageIds)
        toast.success(`${selectedPageIds.length} Facebook Page(s) connected`)
        setSelectedPageIds([])
        router.refresh()
      } catch {
        toast.error("Failed to connect the selected Page(s)")
      }
    })
  }

  function handleSetDefaultPage(connectionId: string) {
    setActiveAction(`default:${connectionId}`)
    startTransition(async () => {
      try {
        await setDefaultFacebookPage(connectionId)
        router.refresh()
      } catch {
        toast.error("Failed to set that Page as default")
      }
    })
  }

  function handleDisconnectPage(connectionId: string) {
    setActiveAction(`disconnect:${connectionId}`)
    startTransition(async () => {
      try {
        await disconnectFacebookPage(connectionId)
        toast.success("Page disconnected")
        router.refresh()
      } catch {
        toast.error("Failed to disconnect that Page")
      }
    })
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {platforms.map(({ key, label, icon: Icon }) => {
          const isReal = REAL_PLATFORMS.has(key)
          const connection = connections?.[key]
          const isConnected = isReal ? Boolean(connection) : connectedSet.has(key)

          return (
            <Card key={key}>
              <CardContent className="flex flex-col items-center gap-3 px-4 py-5 text-center">
                {connection?.thumbnailUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={connection.thumbnailUrl}
                    alt=""
                    referrerPolicy="no-referrer"
                    className="size-6 rounded-full"
                  />
                ) : (
                  <Icon
                    className={cn(
                      "size-6",
                      isConnected ? "text-primary" : "text-muted-foreground"
                    )}
                  />
                )}
                <div>
                  <p className="text-sm font-medium">{label}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {connection
                      ? connection.name
                      : isConnected
                        ? "Connected"
                        : "Not connected"}
                  </p>
                </div>
                {isReal && !isConnected ? (
                  <Button type="button" size="sm" className="w-full" disabled={isBusy}
                    aria-busy={connectingPlatform === key} onClick={() => handleOAuthConnect(key)}>
                    <ActionLabel loading={connectingPlatform === key} idle="Connect" busy="Connecting…" />
                  </Button>
                ) : (
                  <Button
                    type="button"
                    size="sm"
                    variant={isConnected ? "outline" : "default"}
                    className="w-full"
                    disabled={isBusy}
                    aria-busy={isPending && activeAction === `${isConnected ? "disconnect" : "connect"}:${key}`}
                    onClick={() =>
                      isConnected ? handleDisconnect(key) : handleConnect(key)
                    }
                  >
                    <ActionLabel
                      loading={isPending && activeAction === `${isConnected ? "disconnect" : "connect"}:${key}`}
                      idle={isConnected ? "Disconnect" : "Connect"}
                      busy={isConnected ? "Disconnecting…" : "Connecting…"}
                    />
                  </Button>
                )}
              </CardContent>
            </Card>
          )
        })}

        <Card>
          <CardContent className="flex flex-col items-center gap-3 px-4 py-5 text-center">
            {defaultFacebookPage?.thumbnailUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={defaultFacebookPage.thumbnailUrl}
                alt=""
                referrerPolicy="no-referrer"
                className="size-6 rounded-full"
              />
            ) : (
              <ThumbsUp
                className={cn(
                  "size-6",
                  defaultFacebookPage ? "text-primary" : "text-muted-foreground"
                )}
              />
            )}
            <div className="flex flex-col items-center gap-1">
              <div className="flex items-center gap-1.5">
                <p className="text-sm font-medium">Facebook</p>
                {facebookConnections.length > 1 && (
                  <Badge variant="secondary">+{facebookConnections.length - 1} more</Badge>
                )}
              </div>
              <p className="truncate text-xs text-muted-foreground">
                {defaultFacebookPage ? defaultFacebookPage.name : "Not connected"}
              </p>
            </div>
            <Button type="button" size="sm" variant={defaultFacebookPage ? "outline" : "default"}
              className="w-full" disabled={isBusy} aria-busy={connectingPlatform === "FACEBOOK"}
              onClick={() => handleOAuthConnect("FACEBOOK")}>
              <ActionLabel loading={connectingPlatform === "FACEBOOK"}
                idle={defaultFacebookPage ? "Add a Page" : "Connect"} busy="Connecting…" />
            </Button>
          </CardContent>
        </Card>
      </div>

      {manageFacebook && facebookConnections.length > 0 && (
        <Card>
          <CardContent className="flex flex-col gap-3 px-4 py-5">
            <div>
              <p className="text-sm font-medium">Facebook Pages</p>
              <p className="text-xs text-muted-foreground">
                Videos publish to whichever Page is marked default.
              </p>
            </div>
            <div className="flex flex-col gap-2">
              {facebookConnections.map((page) => (
                <div
                  key={page.id}
                  className="flex items-center justify-between gap-3 rounded-lg border p-2"
                >
                  <div className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="fb-default-page"
                      aria-label={`Set ${page.name} as default`}
                      checked={page.isDefault}
                      disabled={isBusy}
                      onChange={() => handleSetDefaultPage(page.id)}
                      className="size-4 accent-primary"
                    />
                    {page.thumbnailUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={page.thumbnailUrl}
                        alt=""
                        referrerPolicy="no-referrer"
                        className="size-6 rounded-full"
                      />
                    ) : (
                      <ThumbsUp className="size-5 text-muted-foreground" />
                    )}
                    <span className="text-sm">{page.name}</span>
                    {page.isDefault && <Badge>Default</Badge>}
                  </div>
                  <Button
                    type="button"
                    size="xs"
                    variant="outline"
                    disabled={isBusy}
                    aria-busy={isPending && activeAction === `disconnect:${page.id}`}
                    onClick={() => handleDisconnectPage(page.id)}
                  >
                    <ActionLabel loading={isPending && activeAction === `disconnect:${page.id}`}
                      idle="Disconnect" busy="Disconnecting…" />
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {pendingFacebookPages && pendingFacebookPages.length > 0 && (
        <Card>
          <CardContent className="flex flex-col gap-3 px-4 py-5">
            <div>
              <p className="text-sm font-medium">Choose Facebook Pages</p>
              <p className="text-xs text-muted-foreground">
                {pendingFacebookPages.length} {pendingFacebookPages.length === 1 ? "Page" : "Pages"} available.
                {" "}Pick which Pages CreatorHub should be able to publish to.
              </p>
            </div>
            <div className="flex flex-col gap-2">
              {pendingFacebookPages.map((page) => {
                const isSelected = selectedPageIds.includes(page.id)
                return (
                  <label
                    key={page.id}
                    className={cn(
                      "flex items-center gap-3 rounded-lg border p-2",
                      page.alreadyConnected && "opacity-60"
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={page.alreadyConnected || isSelected}
                      disabled={page.alreadyConnected || isBusy}
                      onChange={() => toggleSelectedPage(page.id)}
                      className="size-4 accent-primary"
                    />
                    {page.picture ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={page.picture}
                        alt=""
                        referrerPolicy="no-referrer"
                        className="size-6 rounded-full"
                      />
                    ) : (
                      <ThumbsUp className="size-5 text-muted-foreground" />
                    )}
                    <span className="flex-1 text-sm">{page.name}</span>
                    {page.alreadyConnected ? (
                      <Badge variant="secondary">Connected</Badge>
                    ) : isSelected ? (
                      <Badge>Selected</Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">Not connected</span>
                    )}
                  </label>
                )
              })}
            </div>
            <Button
              type="button"
              size="sm"
              disabled={isBusy || selectedPageIds.length === 0}
              aria-busy={isPending && activeAction === "connect:pages"}
              onClick={handleConnectSelectedPages}
            >
              <ActionLabel loading={isPending && activeAction === "connect:pages"}
                idle="Connect selected Pages" busy="Connecting…" />
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
