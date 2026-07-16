const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
const GOOGLE_REVOKE_URL = "https://oauth2.googleapis.com/revoke"
const YOUTUBE_API_BASE = "https://www.googleapis.com/youtube/v3"
const YOUTUBE_UPLOAD_BASE = "https://www.googleapis.com/upload/youtube/v3"

const SCOPES = [
  "https://www.googleapis.com/auth/youtube.upload",
  "https://www.googleapis.com/auth/youtube.readonly",
].join(" ")

export class GoogleApiError extends Error {
  constructor(
    public status: number,
    public body: string
  ) {
    super(`Google API error ${status}: ${body}`)
  }
}

async function assertOk(response: Response) {
  if (!response.ok) {
    throw new GoogleApiError(response.status, await response.text())
  }
}

function getRedirectUri(): string {
  const base = process.env.APP_URL ?? "http://localhost:3000"
  return `${base}/api/platforms/youtube/callback`
}

function getClientCredentials() {
  const clientId = process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET
  if (!clientId || !clientSecret) {
    throw new Error("GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET are not set")
  }
  return { clientId, clientSecret }
}

export function buildAuthorizeUrl(state: string): string {
  const { clientId } = getClientCredentials()
  const url = new URL(GOOGLE_AUTH_URL)
  url.searchParams.set("client_id", clientId)
  url.searchParams.set("redirect_uri", getRedirectUri())
  url.searchParams.set("response_type", "code")
  url.searchParams.set("scope", SCOPES)
  url.searchParams.set("access_type", "offline")
  // Forces Google to always issue a refresh_token, even for a user who
  // connected before — otherwise a re-consent only returns an access_token.
  url.searchParams.set("prompt", "consent")
  url.searchParams.set("state", state)
  return url.toString()
}

export interface GoogleTokens {
  accessToken: string
  refreshToken?: string
  expiresAt: Date
}

export async function exchangeCodeForTokens(code: string): Promise<GoogleTokens> {
  const { clientId, clientSecret } = getClientCredentials()
  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: getRedirectUri(),
      grant_type: "authorization_code",
    }),
  })
  await assertOk(response)

  const data = await response.json()
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: new Date(Date.now() + data.expires_in * 1000),
  }
}

export async function refreshAccessToken(refreshToken: string): Promise<GoogleTokens> {
  const { clientId, clientSecret } = getClientCredentials()
  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "refresh_token",
    }),
  })
  await assertOk(response)

  const data = await response.json()
  return {
    accessToken: data.access_token,
    expiresAt: new Date(Date.now() + data.expires_in * 1000),
  }
}

export async function revokeToken(token: string): Promise<void> {
  await fetch(`${GOOGLE_REVOKE_URL}?token=${encodeURIComponent(token)}`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
  })
}

export interface YouTubeChannelInfo {
  id: string
  title: string
  thumbnailUrl: string | null
}

export async function fetchOwnChannel(accessToken: string): Promise<YouTubeChannelInfo> {
  const response = await fetch(`${YOUTUBE_API_BASE}/channels?part=snippet&mine=true`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  await assertOk(response)

  const data = await response.json()
  const channel = data.items?.[0]
  if (!channel) {
    throw new Error("No YouTube channel found for this Google account")
  }

  return {
    id: channel.id,
    title: channel.snippet.title,
    thumbnailUrl: channel.snippet.thumbnails?.default?.url ?? null,
  }
}

export interface UploadVideoInput {
  accessToken: string
  videoUrl: string
  title: string
  description: string
  tags: string[]
  privacyStatus: "public" | "unlisted" | "private"
  containsSyntheticMedia: boolean
}

export async function uploadVideo(input: UploadVideoInput): Promise<{ videoId: string }> {
  const sourceResponse = await fetch(input.videoUrl)
  if (!sourceResponse.ok) {
    throw new Error("Failed to fetch source video file for upload")
  }
  const contentType = sourceResponse.headers.get("content-type") ?? "video/mp4"
  const videoBuffer = Buffer.from(await sourceResponse.arrayBuffer())

  const metadata = {
    snippet: {
      // YouTube caps title at 100 chars and tags at 500 chars combined.
      title: input.title.slice(0, 100),
      description: input.description.slice(0, 5000),
      tags: input.tags.slice(0, 500),
    },
    status: {
      privacyStatus: input.privacyStatus,
      // Discloses realistic altered/synthetic (e.g. AI-generated) content —
      // required by YouTube's synthetic media policy since 2024.
      containsSyntheticMedia: input.containsSyntheticMedia,
    },
  }

  const initResponse = await fetch(
    `${YOUTUBE_UPLOAD_BASE}/videos?uploadType=resumable&part=snippet,status`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${input.accessToken}`,
        "Content-Type": "application/json",
        "X-Upload-Content-Type": contentType,
        "X-Upload-Content-Length": String(videoBuffer.byteLength),
      },
      body: JSON.stringify(metadata),
    }
  )
  await assertOk(initResponse)

  const uploadUrl = initResponse.headers.get("location")
  if (!uploadUrl) {
    throw new Error("YouTube did not return a resumable upload URL")
  }

  const uploadResponse = await fetch(uploadUrl, {
    method: "PUT",
    headers: {
      "Content-Type": contentType,
      "Content-Length": String(videoBuffer.byteLength),
    },
    body: videoBuffer,
  })
  await assertOk(uploadResponse)

  const result = await uploadResponse.json()
  return { videoId: result.id }
}
