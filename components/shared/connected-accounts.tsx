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
  disconnectYouTubeChannel,
  setDefaultYouTubeChannel,
} from "@/app/(dashboard)/dashboard/accounts/actions"

type SinglePlatform = Exclude<Platform, "FACEBOOK" | "YOUTUBE">

const platforms: {
  key: SinglePlatform
  label: string
  icon: React.ComponentType<{ className?: string }>
}[] = [
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
  if (key === "YOUTUBE") return "YouTube"
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

// Shared shape for any platform that can have several connected accounts —
// Facebook (one row per Page) and YouTube (one row per channel).
export type MultiConnectionInfo = {
  id: string
  name: string
  thumbnailUrl: string | null
  isDefault: boolean
}

export function ConnectedAccounts({
  initialConnected,
  connections,
  facebookConnections = [],
  youtubeConnections = [],
  callbackConnected,
  callbackError,
}: {
  initialConnected: Platform[]
  connections?: Partial<Record<SinglePlatform, PlatformConnectionInfo>>
  facebookConnections?: MultiConnectionInfo[]
  youtubeConnections?: MultiConnectionInfo[]
  callbackConnected?: string
  callbackError?: string
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [activeAction, setActiveAction] = useState<string | null>(null)
  const [connectingPlatform, setConnectingPlatform] = useState<Platform | null>(null)
  const [facebookExpanded, setFacebookExpanded] = useState(callbackConnected === "FACEBOOK")
  const [youtubeExpanded, setYoutubeExpanded] = useState(callbackConnected === "YOUTUBE")
  const isBusy = isPending || connectingPlatform !== null
  const connectedSet = new Set(initialConnected)

  const defaultFacebookPage =
    facebookConnections.find((p) => p.isDefault) ?? facebookConnections[0] ?? null
  const defaultYoutubeChannel =
    youtubeConnections.find((c) => c.isDefault) ?? youtubeConnections[0] ?? null

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
    if (callbackConnected === "FACEBOOK") {
      toast.success(
        `${facebookConnections.length} Facebook ${facebookConnections.length === 1 ? "Page" : "Pages"} connected`
      )
      router.replace("/dashboard/accounts")
    } else if (callbackConnected === "YOUTUBE") {
      toast.success("YouTube channel connected")
      router.replace("/dashboard/accounts")
    } else if (callbackConnected) {
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

  function handleConnect(platform: SinglePlatform) {
    setActiveAction(`connect:${platform}`)
    startTransition(async () => {
      await connectPlatform(platform)
    })
  }

  function handleDisconnect(platform: SinglePlatform) {
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

  function handleSetDefaultFacebookPage(connectionId: string) {
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

  function handleDisconnectFacebookPage(connectionId: string) {
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

  function handleSetDefaultYouTubeChannel(connectionId: string) {
    setActiveAction(`default:${connectionId}`)
    startTransition(async () => {
      try {
        await setDefaultYouTubeChannel(connectionId)
        toast.success("Default YouTube channel updated")
        router.refresh()
      } catch {
        toast.error("Failed to set that channel as default")
      }
    })
  }

  function handleDisconnectYouTubeChannel(connectionId: string) {
    setActiveAction(`disconnect:${connectionId}`)
    startTransition(async () => {
      try {
        await disconnectYouTubeChannel(connectionId)
        toast.success("Channel disconnected")
        router.refresh()
      } catch {
        toast.error("Failed to disconnect that channel")
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

        <MultiAccountCard
          icon={PlaySquare}
          label="YouTube"
          connections={youtubeConnections}
          defaultConnection={defaultYoutubeChannel}
          expanded={youtubeExpanded}
          onToggleExpanded={() => setYoutubeExpanded((current) => !current)}
          itemNounPlural="channels"
          listId="youtube-channel-list"
          isBusy={isBusy}
          connecting={connectingPlatform === "YOUTUBE"}
          onAdd={() => handleOAuthConnect("YOUTUBE")}
          addLabel={defaultYoutubeChannel ? "Add channel" : "Connect"}
        />

        <MultiAccountCard
          icon={ThumbsUp}
          label="Facebook"
          connections={facebookConnections}
          defaultConnection={defaultFacebookPage}
          expanded={facebookExpanded}
          onToggleExpanded={() => setFacebookExpanded((current) => !current)}
          itemNounPlural="Pages"
          listId="facebook-page-list"
          isBusy={isBusy}
          connecting={connectingPlatform === "FACEBOOK"}
          onAdd={() => handleOAuthConnect("FACEBOOK")}
          addLabel={defaultFacebookPage ? "Add Page" : "Connect"}
        />
      </div>

      {youtubeExpanded && youtubeConnections.length > 0 && (
        <MultiAccountList
          id="youtube-channel-list"
          title="Connected YouTube channels"
          description="Each channel is its own Google account connection. Choose where videos publish by default."
          icon={PlaySquare}
          connections={youtubeConnections}
          radioGroupName="yt-default-channel"
          isBusy={isBusy}
          activeAction={activeAction}
          isPending={isPending}
          onSetDefault={handleSetDefaultYouTubeChannel}
          onDisconnect={handleDisconnectYouTubeChannel}
          defaultDescription="Default publishing channel"
          hint="Adding another channel opens Google's account picker so you can sign into a different account."
        />
      )}

      {facebookExpanded && facebookConnections.length > 0 && (
        <MultiAccountList
          id="facebook-page-list"
          title="Connected Facebook Pages"
          description="Pages selected on Facebook appear here automatically. Choose where videos publish by default."
          icon={ThumbsUp}
          connections={facebookConnections}
          radioGroupName="fb-default-page"
          isBusy={isBusy}
          activeAction={activeAction}
          isPending={isPending}
          onSetDefault={handleSetDefaultFacebookPage}
          onDisconnect={handleDisconnectFacebookPage}
          defaultDescription="Default publishing Page"
        />
      )}
    </div>
  )
}

function MultiAccountCard({
  icon: Icon,
  label,
  connections,
  defaultConnection,
  expanded,
  onToggleExpanded,
  itemNounPlural,
  listId,
  isBusy,
  connecting,
  onAdd,
  addLabel,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  connections: MultiConnectionInfo[]
  defaultConnection: MultiConnectionInfo | null
  expanded: boolean
  onToggleExpanded: () => void
  itemNounPlural: string
  listId: string
  isBusy: boolean
  connecting: boolean
  onAdd: () => void
  addLabel: string
}) {
  return (
    <Card className={cn(defaultConnection && "ring-primary/20")}>
      <CardContent className="flex flex-col gap-3 px-4 py-5 text-center">
        <button
          type="button"
          disabled={!defaultConnection}
          aria-expanded={expanded}
          aria-controls={listId}
          onClick={onToggleExpanded}
          className="flex w-full flex-col items-center gap-3 rounded-lg outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-default"
        >
          {defaultConnection?.thumbnailUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={defaultConnection.thumbnailUrl}
              alt=""
              referrerPolicy="no-referrer"
              className="size-7 rounded-full"
            />
          ) : (
            <Icon
              className={cn("size-6", defaultConnection ? "text-primary" : "text-muted-foreground")}
            />
          )}
          <div className="min-w-0">
            <div className="flex items-center justify-center gap-1.5">
              <p className="text-sm font-medium">{label}</p>
              {defaultConnection && (
                <CheckCircle2 className="size-3.5 text-emerald-600" aria-label="Connected" />
              )}
            </div>
            <p className="truncate text-xs text-muted-foreground">
              {defaultConnection ? `${connections.length} ${itemNounPlural} connected` : "Not connected"}
            </p>
          </div>
          {defaultConnection && (
            <span className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
              View {itemNounPlural}
              <ChevronDown
                className={cn("size-3.5 transition-transform", expanded && "rotate-180")}
                aria-hidden="true"
              />
            </span>
          )}
        </button>

        <Button
          type="button"
          size="sm"
          variant={defaultConnection ? "outline" : "default"}
          className="w-full"
          disabled={isBusy}
          aria-busy={connecting}
          onClick={onAdd}
        >
          <ActionLabel loading={connecting} idle={addLabel} busy="Connecting…" />
        </Button>
      </CardContent>
    </Card>
  )
}

function MultiAccountList({
  id,
  title,
  description,
  icon: Icon,
  connections,
  radioGroupName,
  isBusy,
  activeAction,
  isPending,
  onSetDefault,
  onDisconnect,
  defaultDescription,
  hint,
}: {
  id: string
  title: string
  description: string
  icon: React.ComponentType<{ className?: string }>
  connections: MultiConnectionInfo[]
  radioGroupName: string
  isBusy: boolean
  activeAction: string | null
  isPending: boolean
  onSetDefault: (connectionId: string) => void
  onDisconnect: (connectionId: string) => void
  defaultDescription: string
  hint?: string
}) {
  return (
    <Card id={id}>
      <CardContent className="flex flex-col gap-4 px-4 py-5">
        <div>
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium">{title}</p>
            <Badge variant="secondary">{connections.length}</Badge>
          </div>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
        <div className="flex flex-col gap-2">
          {connections.map((connection) => (
            <div
              key={connection.id}
              className={cn(
                "flex flex-col gap-3 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between",
                connection.isDefault && "border-primary/30 bg-muted/40"
              )}
            >
              <label className="flex min-w-0 cursor-pointer items-center gap-3">
                <input
                  type="radio"
                  name={radioGroupName}
                  aria-label={`Set ${connection.name} as default`}
                  checked={connection.isDefault}
                  disabled={isBusy}
                  onChange={() => onSetDefault(connection.id)}
                  className="size-4 shrink-0 accent-primary"
                />
                {connection.thumbnailUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={connection.thumbnailUrl}
                    alt=""
                    referrerPolicy="no-referrer"
                    className="size-8 rounded-full"
                  />
                ) : (
                  <span className="flex size-8 items-center justify-center rounded-full bg-muted">
                    <Icon className="size-4 text-muted-foreground" />
                  </span>
                )}
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium">{connection.name}</span>
                  <span className="block text-xs text-muted-foreground">
                    {connection.isDefault ? defaultDescription : "Connected"}
                  </span>
                </span>
                {connection.isDefault && <Badge>Default</Badge>}
              </label>
              <Button
                type="button"
                size="xs"
                variant="destructive"
                className="self-end sm:self-auto"
                disabled={isBusy}
                aria-busy={isPending && activeAction === `disconnect:${connection.id}`}
                onClick={() => onDisconnect(connection.id)}
              >
                <ActionLabel
                  loading={isPending && activeAction === `disconnect:${connection.id}`}
                  idle="Disconnect"
                  busy="Disconnecting…"
                />
              </Button>
            </div>
          ))}
        </div>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </CardContent>
    </Card>
  )
}
