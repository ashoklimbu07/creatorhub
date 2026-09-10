import { z } from "zod"

const API = "https://open.tiktokapis.com/v2"

export function getTikTokRedirectUri() {
  const url = new URL(process.env.APP_URL ?? "http://localhost:3000")
  if (url.protocol !== "https:") throw new Error("TikTok requires an HTTPS APP_URL")
  return new URL("/api/platforms/tiktok/callback", url).toString()
}

function credentials() {
  const client_key = process.env.TIKTOK_CLIENT_KEY
  const client_secret = process.env.TIKTOK_CLIENT_SECRET
  if (!client_key || !client_secret) throw new Error("TikTok credentials are not configured")
  return { client_key, client_secret }
}

export function buildTikTokAuthorizeUrl(state: string) {
  const { client_key } = credentials()
  const url = new URL("https://www.tiktok.com/v2/auth/authorize/")
  url.search = new URLSearchParams({ client_key, redirect_uri: getTikTokRedirectUri(),
    response_type: "code", scope: "user.info.basic", state }).toString()
  return url.toString()
}

// Provider responses can contain credentials; never include them in errors.
async function request(path: string, init: RequestInit) {
  const response = await fetch(`${API}${path}`, {
    ...init, cache: "no-store", signal: AbortSignal.timeout(20000),
  })
  const data = await response.json()
  if (!response.ok || (data.error && data.error.code !== "ok")) {
    throw new Error("TikTok rejected the request. Try reconnecting the account.")
  }
  return data
}

const tokenSchema = z.object({ access_token: z.string().min(1), refresh_token: z.string().min(1),
  open_id: z.string().min(1), expires_in: z.number().positive(), scope: z.string() })

async function tokens(params: Record<string, string>) {
  const data = tokenSchema.safeParse(await request("/oauth/token/", {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ ...credentials(), ...params }),
  }))
  if (!data.success || !data.data.scope.split(",").includes("user.info.basic")) {
    throw new Error("TikTok did not grant basic profile access")
  }
  return { accessToken: data.data.access_token, refreshToken: data.data.refresh_token,
    openId: data.data.open_id, expiresAt: new Date(Date.now() + data.data.expires_in * 1000) }
}

export function exchangeTikTokCode(code: string) {
  return tokens({ code, grant_type: "authorization_code", redirect_uri: getTikTokRedirectUri() })
}

export function refreshTikTokToken(refreshToken: string) {
  return tokens({ refresh_token: refreshToken, grant_type: "refresh_token" })
}

export async function fetchTikTokProfile(accessToken: string) {
  const result = await request("/user/info/?fields=open_id,display_name,avatar_url", {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  const profile = z.object({ open_id: z.string().min(1), display_name: z.string().min(1),
    avatar_url: z.string().url().optional() }).safeParse(result.data?.user)
  if (!profile.success) throw new Error("TikTok did not return an account profile")
  return profile.data
}

export async function revokeTikTokToken(accessToken: string) {
  await request("/oauth/revoke/", {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ ...credentials(), token: accessToken }),
  })
}
