const GRAPH_VERSION = "v21.0"
const FACEBOOK_GRAPH_BASE = "https://graph.facebook.com"
const FACEBOOK_DIALOG_BASE = "https://www.facebook.com"
const INSTAGRAM_AUTH_URL = "https://www.instagram.com/oauth/authorize"
const INSTAGRAM_TOKEN_URL = "https://api.instagram.com/oauth/access_token"
const INSTAGRAM_GRAPH_BASE = "https://graph.instagram.com"

const INSTAGRAM_SCOPES = [
  "instagram_business_basic",
  "instagram_business_content_publish",
].join(",")

export class MetaApiError extends Error {
  constructor(
    public status: number,
    public code: number | undefined,
    public body: string
  ) {
    super(`Meta API error ${status}${code !== undefined ? ` (code ${code})` : ""}: ${body}`)
  }
}

function mapMetaError(error: unknown, platformLabel: string): string {
  if (error instanceof MetaApiError) {
    if (error.code === 190) {
      return `${platformLabel} access expired or was revoked — reconnect your account.`
    }
    if (error.code === 4 || error.code === 17 || error.code === 32 || error.code === 613) {
      return `${platformLabel} rate limit hit — try again later.`
    }
    if (error.status === 400) {
      return `${platformLabel} rejected this upload — check the video format, URL, and caption length.`
    }
    return `${platformLabel} upload failed (HTTP ${error.status}).`
  }
  if (error instanceof Error) return error.message
  return `Unknown error while publishing to ${platformLabel}.`
}

export function mapInstagramError(error: unknown): string {
  return mapMetaError(error, "Instagram")
}

export function mapFacebookError(error: unknown): string {
  return mapMetaError(error, "Facebook")
}

async function assertOk(response: Response): Promise<void> {
  if (!response.ok) {
    const text = await response.text()
    let code: number | undefined
    try {
      code = JSON.parse(text)?.error?.code
    } catch {
      // Body wasn't JSON — leave code undefined, mapMetaError falls back to status.
    }
    throw new MetaApiError(response.status, code, text)
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function getMetaCredentials() {
  const appId = process.env.META_APP_ID
  const appSecret = process.env.META_APP_SECRET
  if (!appId || !appSecret) {
    throw new Error("META_APP_ID / META_APP_SECRET are not set")
  }
  return { appId, appSecret }
}

// Instagram Business Login (instagram.com/oauth/authorize, api.instagram.com,
// graph.instagram.com) validates against its own Instagram App ID/Secret —
// shown on the Instagram product's "API setup with Instagram login" page in
// the App Dashboard — which is a different pair from the main App ID/Secret
// under App Settings > Basic used by the Facebook Login for Business flow.
// Reusing the main App ID here is what produces Instagram's
// "Invalid platform app" error.
function getInstagramCredentials() {
  const appId = process.env.META_INSTAGRAM_APP_ID
  const appSecret = process.env.META_INSTAGRAM_APP_SECRET
  if (!appId || !appSecret) {
    throw new Error("META_INSTAGRAM_APP_ID / META_INSTAGRAM_APP_SECRET are not set")
  }
  return { appId, appSecret }
}

function getFacebookConfigId(): string {
  const configId = process.env.META_FACEBOOK_CONFIG_ID
  if (!configId) {
    throw new Error("META_FACEBOOK_CONFIG_ID is not set")
  }
  return configId
}

function getAppUrl(): string {
  return process.env.APP_URL ?? "http://localhost:3000"
}

// Meta requires each product's OAuth redirect URI to be registered exactly —
// Instagram (API with Instagram Login) and Facebook Login for Business each
// have their own "Valid OAuth Redirect URIs" field in the dashboard, so we
// compute two distinct callback URLs the same way YouTube derives its own
// from APP_URL, rather than a single shared META_REDIRECT_URI.
export function getInstagramRedirectUri(): string {
  return `${getAppUrl()}/api/platforms/instagram/callback`
}

export function getFacebookRedirectUri(): string {
  return `${getAppUrl()}/api/platforms/facebook/callback`
}

// ---------------------------------------------------------------------------
// Instagram (API with Instagram Login) — no linked Facebook Page required.
// ---------------------------------------------------------------------------

export function buildInstagramAuthorizeUrl(state: string): string {
  const { appId } = getInstagramCredentials()
  const url = new URL(INSTAGRAM_AUTH_URL)
  url.searchParams.set("client_id", appId)
  url.searchParams.set("redirect_uri", getInstagramRedirectUri())
  url.searchParams.set("response_type", "code")
  url.searchParams.set("scope", INSTAGRAM_SCOPES)
  url.searchParams.set("state", state)
  // Without this, Instagram silently re-grants whatever account the browser
  // is already logged into and never re-shows its login/account chooser —
  // so a user who wants to add a second Instagram account stays stuck on
  // their original one. `force_reauth` forces the dialog to prompt again,
  // mirroring Facebook's `auth_type=rerequest` and Google's
  // `prompt=select_account` for the same reason.
  url.searchParams.set("force_reauth", "true")
  return url.toString()
}

export interface InstagramShortLivedToken {
  accessToken: string
  igUserId: string
}

export async function exchangeInstagramCode(code: string): Promise<InstagramShortLivedToken> {
  const { appId, appSecret } = getInstagramCredentials()
  const response = await fetch(INSTAGRAM_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: appId,
      client_secret: appSecret,
      grant_type: "authorization_code",
      redirect_uri: getInstagramRedirectUri(),
      code,
    }),
  })
  await assertOk(response)

  const data = await response.json()
  return { accessToken: data.access_token, igUserId: String(data.user_id) }
}

export interface InstagramLongLivedToken {
  accessToken: string
  expiresAt: Date
}

export async function exchangeForLongLivedInstagramToken(
  shortLivedToken: string
): Promise<InstagramLongLivedToken> {
  const { appSecret } = getInstagramCredentials()
  const url = new URL(`${INSTAGRAM_GRAPH_BASE}/access_token`)
  url.searchParams.set("grant_type", "ig_exchange_token")
  url.searchParams.set("client_secret", appSecret)
  url.searchParams.set("access_token", shortLivedToken)

  const response = await fetch(url.toString())
  await assertOk(response)

  const data = await response.json()
  return {
    accessToken: data.access_token,
    expiresAt: new Date(Date.now() + (data.expires_in ?? 5_184_000) * 1000),
  }
}

// Instagram long-lived tokens must be at least 24h old to refresh — this is
// meant to be called well before expiry (see instagram.service's expiry
// buffer), not on every publish.
export async function refreshLongLivedInstagramToken(
  longLivedToken: string
): Promise<InstagramLongLivedToken> {
  const url = new URL(`${INSTAGRAM_GRAPH_BASE}/refresh_access_token`)
  url.searchParams.set("grant_type", "ig_refresh_token")
  url.searchParams.set("access_token", longLivedToken)

  const response = await fetch(url.toString())
  await assertOk(response)

  const data = await response.json()
  return {
    accessToken: data.access_token,
    expiresAt: new Date(Date.now() + (data.expires_in ?? 5_184_000) * 1000),
  }
}

export interface InstagramProfile {
  username: string
  profilePictureUrl: string | null
}

export async function fetchInstagramProfile(accessToken: string): Promise<InstagramProfile> {
  const url = new URL(`${INSTAGRAM_GRAPH_BASE}/${GRAPH_VERSION}/me`)
  url.searchParams.set("fields", "username,profile_picture_url")
  url.searchParams.set("access_token", accessToken)

  const response = await fetch(url.toString())
  await assertOk(response)

  const data = await response.json()
  return {
    username: data.username,
    profilePictureUrl: data.profile_picture_url ?? null,
  }
}

export interface CreateInstagramContainerInput {
  accessToken: string
  igUserId: string
  videoUrl: string
  caption: string
}

export async function createInstagramContainer(
  input: CreateInstagramContainerInput
): Promise<{ containerId: string }> {
  const url = new URL(`${INSTAGRAM_GRAPH_BASE}/${GRAPH_VERSION}/${input.igUserId}/media`)
  // Regular feed video posts are unified under Reels in the Content
  // Publishing API; share_to_feed keeps it visible on the profile grid too.
  url.searchParams.set("media_type", "REELS")
  url.searchParams.set("share_to_feed", "true")
  url.searchParams.set("video_url", input.videoUrl)
  url.searchParams.set("caption", input.caption.slice(0, 2200))
  url.searchParams.set("access_token", input.accessToken)

  const response = await fetch(url.toString(), { method: "POST" })
  await assertOk(response)

  const data = await response.json()
  return { containerId: data.id }
}

async function getInstagramContainerStatus(input: {
  accessToken: string
  containerId: string
}): Promise<string> {
  const url = new URL(`${INSTAGRAM_GRAPH_BASE}/${GRAPH_VERSION}/${input.containerId}`)
  url.searchParams.set("fields", "status_code")
  url.searchParams.set("access_token", input.accessToken)

  const response = await fetch(url.toString())
  await assertOk(response)

  const data = await response.json()
  return data.status_code as string
}

const POLL_INTERVAL_MS = 3000
const MAX_POLL_ATTEMPTS = 40 // ~2 minutes, generous for Instagram's video processing step

export async function waitForInstagramContainer(input: {
  accessToken: string
  containerId: string
}): Promise<void> {
  for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt++) {
    const statusCode = await getInstagramContainerStatus(input)
    if (statusCode === "FINISHED") return
    if (statusCode === "ERROR" || statusCode === "EXPIRED") {
      throw new Error(`Instagram couldn't process this video (status: ${statusCode}).`)
    }
    await sleep(POLL_INTERVAL_MS)
  }
  throw new Error("Timed out waiting for Instagram to finish processing this video.")
}

export async function publishInstagramContainer(input: {
  accessToken: string
  igUserId: string
  containerId: string
}): Promise<{ mediaId: string }> {
  const url = new URL(`${INSTAGRAM_GRAPH_BASE}/${GRAPH_VERSION}/${input.igUserId}/media_publish`)
  url.searchParams.set("creation_id", input.containerId)
  url.searchParams.set("access_token", input.accessToken)

  const response = await fetch(url.toString(), { method: "POST" })
  await assertOk(response)

  const data = await response.json()
  return { mediaId: data.id }
}

// ---------------------------------------------------------------------------
// Facebook Login for Business — Page publishing.
// ---------------------------------------------------------------------------

// Facebook Login for Business apps request permissions via a pre-built Login
// Configuration (config_id) rather than a plain `scope` param — the
// permission set (pages_show_list, pages_manage_posts, pages_read_engagement)
// lives on that configuration in the Meta dashboard, not here.
export function buildFacebookAuthorizeUrl(state: string): string {
  const { appId } = getMetaCredentials()
  const url = new URL(`${FACEBOOK_DIALOG_BASE}/${GRAPH_VERSION}/dialog/oauth`)
  url.searchParams.set("client_id", appId)
  url.searchParams.set("redirect_uri", getFacebookRedirectUri())
  url.searchParams.set("response_type", "code")
  url.searchParams.set("config_id", getFacebookConfigId())
  url.searchParams.set("state", state)
  // Without this, Facebook silently re-grants whatever Page(s) the user
  // picked on their very first authorization and never re-shows the Page
  // picker on later logins — so a user who wants to switch/add Pages stays
  // stuck on their original choice. `rerequest` forces the full consent
  // dialog (including the Page picker) to show again every time.
  url.searchParams.set("auth_type", "rerequest")
  return url.toString()
}

export interface FacebookUserToken {
  accessToken: string
  expiresAt: Date
}

export async function exchangeFacebookCode(code: string): Promise<FacebookUserToken> {
  const { appId, appSecret } = getMetaCredentials()
  const url = new URL(`${FACEBOOK_GRAPH_BASE}/${GRAPH_VERSION}/oauth/access_token`)
  url.searchParams.set("client_id", appId)
  url.searchParams.set("client_secret", appSecret)
  url.searchParams.set("redirect_uri", getFacebookRedirectUri())
  url.searchParams.set("code", code)

  const response = await fetch(url.toString())
  await assertOk(response)

  const data = await response.json()
  return {
    accessToken: data.access_token,
    expiresAt: new Date(Date.now() + (data.expires_in ?? 3600) * 1000),
  }
}

export async function exchangeForLongLivedFacebookUserToken(
  shortLivedToken: string
): Promise<FacebookUserToken> {
  const { appId, appSecret } = getMetaCredentials()
  const url = new URL(`${FACEBOOK_GRAPH_BASE}/${GRAPH_VERSION}/oauth/access_token`)
  url.searchParams.set("grant_type", "fb_exchange_token")
  url.searchParams.set("client_id", appId)
  url.searchParams.set("client_secret", appSecret)
  url.searchParams.set("fb_exchange_token", shortLivedToken)

  const response = await fetch(url.toString())
  await assertOk(response)

  const data = await response.json()
  return {
    accessToken: data.access_token,
    expiresAt: new Date(Date.now() + (data.expires_in ?? 5_184_000) * 1000),
  }
}

export interface FacebookPageInfo {
  id: string
  name: string
  accessToken: string
  picture: string | null
}

export async function fetchFacebookPages(userAccessToken: string): Promise<FacebookPageInfo[]> {
  const pages = new Map<string, FacebookPageInfo>()
  function addPage(page: Record<string, unknown>) {
    if (typeof page.id !== "string" || typeof page.name !== "string" ||
        typeof page.access_token !== "string" || !page.access_token) return
    pages.set(page.id, {
      id: page.id,
      name: page.name,
      accessToken: page.access_token,
      picture: `${FACEBOOK_GRAPH_BASE}/${GRAPH_VERSION}/${page.id}/picture?type=square`,
    })
  }

  const url = new URL(`${FACEBOOK_GRAPH_BASE}/${GRAPH_VERSION}/me/accounts`)
  url.searchParams.set("fields", "id,name,access_token")
  const headers = { Authorization: `Bearer ${userAccessToken}` }
  const seenCursors = new Set<string>()

  while (true) {
    const response = await fetch(url.toString(), { headers, cache: "no-store" })
    await assertOk(response)
    const data = await response.json()
    for (const page of data.data ?? []) addPage(page)
    const after = data.paging?.cursors?.after
    if (!data.paging?.next || typeof after !== "string" || seenCursors.has(after)) break
    seenCursors.add(after)
    // Build the next request ourselves; never forward credentials to a URL
    // taken from the response.
    url.searchParams.set("after", after)
  }

  // Business-managed Pages can be absent from /me/accounts even when the
  // user selected them and Meta granted a Page token. Resolve only the Page
  // IDs explicitly authorized for pages_show_list, never arbitrary assets.
  try {
    const { appId, appSecret } = getMetaCredentials()
    const debugUrl = new URL(`${FACEBOOK_GRAPH_BASE}/${GRAPH_VERSION}/debug_token`)
    debugUrl.searchParams.set("input_token", userAccessToken)
    const response = await fetch(debugUrl.toString(), {
      headers: { Authorization: `Bearer ${appId}|${appSecret}` },
      cache: "no-store",
    })
    await assertOk(response)
    const { data } = await response.json()
    if (data?.is_valid && data.app_id === appId) {
      const grants = (data.granular_scopes ?? []) as Array<{ scope: string; target_ids?: string[] }>
      const pageIds = new Set(grants
        .filter((grant) => grant.scope === "pages_show_list")
        .flatMap((grant) => grant.target_ids ?? []))
      for (const pageId of pageIds) {
        if (pages.has(pageId) || !/^\d+$/.test(pageId)) continue
        try {
          const pageUrl = new URL(`${FACEBOOK_GRAPH_BASE}/${GRAPH_VERSION}/${pageId}`)
          pageUrl.searchParams.set("fields", "id,name,access_token")
          const pageResponse = await fetch(pageUrl.toString(), { headers, cache: "no-store" })
          await assertOk(pageResponse)
          const page = await pageResponse.json()
          if (page.id === pageId) addPage(page)
        } catch (error) {
          if (error instanceof MetaApiError && error.code === 190) throw error
          console.warn("[facebook] Could not retrieve an authorized Page", {
            pageId, code: error instanceof MetaApiError ? error.code : undefined,
          })
        }
      }
    }
  } catch (error) {
    // An optional discovery request must not hide Pages already returned by
    // /me/accounts. Expired credentials still need reauthorization.
    if (pages.size === 0 || (error instanceof MetaApiError && error.code === 190)) throw error
    console.warn("[facebook] Could not inspect additional Page grants", {
      code: error instanceof MetaApiError ? error.code : undefined,
    })
  }

  return [...pages.values()]
}

export interface FacebookPermission {
  permission: string
  status: string
}

// Diagnostic-only: called when /me/accounts comes back empty so the server
// log shows *why* (declined scope vs. granted-but-no-manageable-Pages)
// instead of just the empty result.
export async function fetchFacebookGrantedPermissions(
  userAccessToken: string
): Promise<FacebookPermission[]> {
  const url = new URL(`${FACEBOOK_GRAPH_BASE}/${GRAPH_VERSION}/me/permissions`)
  url.searchParams.set("access_token", userAccessToken)

  const response = await fetch(url.toString())
  await assertOk(response)

  const data = await response.json()
  return (data.data ?? []) as FacebookPermission[]
}

export async function revokeFacebookPermissions(userAccessToken: string): Promise<void> {
  const url = new URL(`${FACEBOOK_GRAPH_BASE}/${GRAPH_VERSION}/me/permissions`)
  url.searchParams.set("access_token", userAccessToken)
  await fetch(url.toString(), { method: "DELETE" })
}

export interface FacebookVideoUploadInput {
  pageId: string
  pageAccessToken: string
  videoUrl: string
  description: string
}

export async function uploadFacebookVideo(
  input: FacebookVideoUploadInput
): Promise<{ videoId: string }> {
  const url = new URL(`${FACEBOOK_GRAPH_BASE}/${GRAPH_VERSION}/${input.pageId}/videos`)
  url.searchParams.set("file_url", input.videoUrl)
  url.searchParams.set("description", input.description.slice(0, 63_206))
  url.searchParams.set("access_token", input.pageAccessToken)

  const response = await fetch(url.toString(), { method: "POST" })
  await assertOk(response)

  const data = await response.json()
  return { videoId: data.id }
}
