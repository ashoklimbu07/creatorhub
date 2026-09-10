import assert from "node:assert/strict"
import { afterEach, beforeEach, test } from "node:test"
import { buildTikTokAuthorizeUrl, exchangeTikTokCode, fetchTikTokProfile, refreshTikTokToken, revokeTikTokToken } from "./tiktok-oauth"

const originalFetch = globalThis.fetch
const keys = ["APP_URL", "TIKTOK_CLIENT_KEY", "TIKTOK_CLIENT_SECRET"] as const
const originalEnv = Object.fromEntries(keys.map((key) => [key, process.env[key]]))
beforeEach(() => {
  process.env.APP_URL = "https://creator.example/"
  process.env.TIKTOK_CLIENT_KEY = "test-key"
  process.env.TIKTOK_CLIENT_SECRET = "test-secret"
})
afterEach(() => {
  globalThis.fetch = originalFetch
  for (const key of keys) {
    if (originalEnv[key] === undefined) delete process.env[key]
    else process.env[key] = originalEnv[key]
  }
})

const tokens = { access_token: "access", refresh_token: "rotated-refresh", open_id: "account-1", expires_in: 86400, scope: "user.info.basic" }

test("authorization uses registered HTTPS callback, state and minimum scope without exposing the secret", () => {
  const url = new URL(buildTikTokAuthorizeUrl("browser-nonce"))
  assert.equal(url.origin, "https://www.tiktok.com")
  assert.equal(url.searchParams.get("redirect_uri"), "https://creator.example/api/platforms/tiktok/callback")
  assert.equal(url.searchParams.get("state"), "browser-nonce")
  assert.equal(url.searchParams.get("scope"), "user.info.basic")
  assert.equal(url.searchParams.has("client_secret"), false)
  process.env.APP_URL = "http://localhost:3000"
  assert.throws(() => buildTikTokAuthorizeUrl("state"), /HTTPS/)
})

test("code exchange encodes credentials and preserves the decoded authorization code", async () => {
  globalThis.fetch = async (url, init) => {
    assert.equal(String(url), "https://open.tiktokapis.com/v2/oauth/token/")
    assert.equal(init?.cache, "no-store")
    const body = new URLSearchParams(String(init?.body))
    assert.equal(body.get("code"), "code+with&symbols")
    assert.equal(body.get("client_secret"), "test-secret")
    assert.equal(body.get("grant_type"), "authorization_code")
    return Response.json(tokens)
  }
  const result = await exchangeTikTokCode("code+with&symbols")
  assert.equal(result.openId, "account-1")
  assert.equal(result.refreshToken, "rotated-refresh")
  assert.ok(result.expiresAt.getTime() > Date.now())
})

test("refresh accepts rotated credentials and revocation targets the supplied grant", async () => {
  globalThis.fetch = async (url, init) => {
    const body = new URLSearchParams(String(init?.body))
    if (String(url).endsWith("/revoke/")) {
      assert.equal(body.get("token"), "access")
      return Response.json({})
    }
    assert.equal(body.get("grant_type"), "refresh_token")
    assert.equal(body.get("refresh_token"), "old-refresh")
    return Response.json(tokens)
  }
  assert.equal((await refreshTikTokToken("old-refresh")).refreshToken, "rotated-refresh")
  await revokeTikTokToken("access")
})

test("provider errors, missing scope, and malformed tokens cannot become connections", async () => {
  for (const response of [
    { error: "invalid_grant", error_description: "sensitive-provider-detail" },
    { ...tokens, scope: "video.list" },
    { ...tokens, refresh_token: "" },
  ]) {
    globalThis.fetch = async () => Response.json(response)
    await assert.rejects(exchangeTikTokCode("code"), (error: Error) => {
      assert.ok(!error.message.includes("sensitive-provider-detail"))
      return true
    })
  }
})

test("profile lookup requests only basic fields and rejects missing identity", async () => {
  globalThis.fetch = async (url, init) => {
    assert.equal(new URL(String(url)).searchParams.get("fields"), "open_id,display_name,avatar_url")
    assert.equal(new Headers(init?.headers).get("authorization"), "Bearer access")
    return Response.json({ data: { user: { open_id: "account-1", display_name: "Creator" } }, error: { code: "ok" } })
  }
  assert.equal((await fetchTikTokProfile("access")).display_name, "Creator")
  globalThis.fetch = async () => Response.json({ data: { user: { display_name: "Creator" } } })
  await assert.rejects(fetchTikTokProfile("access"), /profile/)
})
