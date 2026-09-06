"use client"

import { useEffect, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import {
  PlaySquare,
  Music2,
  Camera,
  ThumbsUp,
  LoaderCircle,
  ChevronDown,
  CheckCircle2,
} from "lucide-react"
import { toast } from "sonner"
import type { Platform } from "@prisma/client"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import {
  connectPlatform,
  disconnectPlatform,
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

export function ConnectedAccounts({
  initialConnected,
  connections,
  facebookConnections = [],
  callbackConnected,
  callbackError,
}: {
  initialConnected: Platform[]
  connections?: Partial<Record<Exclude<Platform, "FACEBOOK">, PlatformConnectionInfo>>
  facebookConnections?: FacebookPageConnectionInfo[]
  callbackConnected?: string
  callbackError?: string
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [activeAction, setActiveAction] = useState<string | null>(null)
  const [connectingPlatform, setConnectingPlatform] = useState<Platform | null>(null)
  const [facebookExpanded, setFacebookExpanded] = useState(callbackConnected === "FACEBOOK")
  const isBusy = isPending || connectingPlatform !== null
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
      toast.success(
        callbackConnected === "FACEBOOK"
          ? `${facebookConnections.length} Facebook ${facebookConnections.length === 1 ? "Page" : "Pages"} connected`
          : `${platformLabel(callbackConnected)} connected`
      )
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

  function handleSetDefaultPage(connectionId: string) {
    setActiveAction(`default:${connectionId}`)
    startTransition(async () => {
      try {
        await setDefaultFacebookPage(connectionId)
        toast.success("Default Facebook Page updated")
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

        <Card className={cn(defaultFacebookPage && "ring-primary/20")}>
          <CardContent className="flex flex-col gap-3 px-4 py-5 text-center">
            <button
              type="button"
              disabled={!defaultFacebookPage}
              aria-expanded={facebookExpanded}
              aria-controls="facebook-page-list"
              onClick={() => setFacebookExpanded((current) => !current)}
              className="flex w-full flex-col items-center gap-3 rounded-lg outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-default"
            >
              {defaultFacebookPage?.thumbnailUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={defaultFacebookPage.thumbnailUrl}
                  alt=""
                  referrerPolicy="no-referrer"
                  className="size-7 rounded-full"
                />
              ) : (
                <ThumbsUp
                  className={cn(
                    "size-6",
                    defaultFacebookPage ? "text-primary" : "text-muted-foreground"
                  )}
                />
              )}
              <div className="min-w-0">
                <div className="flex items-center justify-center gap-1.5">
                  <p className="text-sm font-medium">Facebook</p>
                  {defaultFacebookPage && (
                    <CheckCircle2 className="size-3.5 text-emerald-600" aria-label="Connected" />
                  )}
                </div>
                <p className="truncate text-xs text-muted-foreground">
                  {defaultFacebookPage
                    ? `${facebookConnections.length} ${facebookConnections.length === 1 ? "Page" : "Pages"} connected`
                    : "Not connected"}
                </p>
              </div>
              {defaultFacebookPage && (
                <span className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
                  View Pages
                  <ChevronDown
                    className={cn("size-3.5 transition-transform", facebookExpanded && "rotate-180")}
                    aria-hidden="true"
                  />
                </span>
              )}
            </button>

            {defaultFacebookPage ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="w-full"
                disabled={isBusy}
                aria-busy={connectingPlatform === "FACEBOOK"}
                onClick={() => handleOAuthConnect("FACEBOOK")}
              >
                <ActionLabel
                  loading={connectingPlatform === "FACEBOOK"}
                  idle="Add Page"
                  busy="Connecting…"
                />
              </Button>
            ) : (
              <Button
                type="button"
                size="sm"
                className="w-full"
                disabled={isBusy}
                aria-busy={connectingPlatform === "FACEBOOK"}
                onClick={() => handleOAuthConnect("FACEBOOK")}
              >
                <ActionLabel
                  loading={connectingPlatform === "FACEBOOK"}
                  idle="Connect"
                  busy="Connecting…"
                />
              </Button>
            )}
          </CardContent>
        </Card>
      </div>

      {facebookExpanded && facebookConnections.length > 0 && (
        <Card id="facebook-page-list">
          <CardContent className="flex flex-col gap-4 px-4 py-5">
            <div>
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium">Connected Facebook Pages</p>
                  <Badge variant="secondary">{facebookConnections.length}</Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  Pages selected on Facebook appear here automatically. Choose where videos publish by default.
                </p>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              {facebookConnections.map((page) => (
                <div
                  key={page.id}
                  className={cn(
                    "flex flex-col gap-3 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between",
                    page.isDefault && "border-primary/30 bg-muted/40"
                  )}
                >
                  <label className="flex min-w-0 cursor-pointer items-center gap-3">
                    <input
                      type="radio"
                      name="fb-default-page"
                      aria-label={`Set ${page.name} as default`}
                      checked={page.isDefault}
                      disabled={isBusy}
                      onChange={() => handleSetDefaultPage(page.id)}
                      className="size-4 shrink-0 accent-primary"
                    />
                    {page.thumbnailUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={page.thumbnailUrl}
                        alt=""
                        referrerPolicy="no-referrer"
                        className="size-8 rounded-full"
                      />
                    ) : (
                      <span className="flex size-8 items-center justify-center rounded-full bg-muted">
                        <ThumbsUp className="size-4 text-muted-foreground" />
                      </span>
                    )}
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">{page.name}</span>
                      <span className="block text-xs text-muted-foreground">
                        {page.isDefault ? "Default publishing Page" : "Connected"}
                      </span>
                    </span>
                    {page.isDefault && <Badge>Default</Badge>}
                  </label>
                  <Button
                    type="button"
                    size="xs"
                    variant="destructive"
                    className="self-end sm:self-auto"
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
    </div>
  )
}
