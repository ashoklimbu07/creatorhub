import assert from "node:assert/strict"
import { afterEach, test } from "node:test"
import { fetchFacebookPages } from "./meta-oauth"

const originalFetch = globalThis.fetch
const originalAppId = process.env.META_APP_ID
const originalAppSecret = process.env.META_APP_SECRET

afterEach(() => {
  globalThis.fetch = originalFetch
  if (originalAppId === undefined) delete process.env.META_APP_ID
  else process.env.META_APP_ID = originalAppId
  if (originalAppSecret === undefined) delete process.env.META_APP_SECRET
  else process.env.META_APP_SECRET = originalAppSecret
})

function mockGraph(handler: (url: URL) => unknown) {
  process.env.META_APP_ID = "test-app"
  process.env.META_APP_SECRET = "test-secret"
  globalThis.fetch = async (input, init) => {
    const url = new URL(String(input))
    assert.equal(url.origin, "https://graph.facebook.com")
    assert.equal(init?.cache, "no-store")
    assert.equal(new Headers(init?.headers).get("Authorization"),
      url.pathname.endsWith("/debug_token") ? "Bearer test-app|test-secret" : "Bearer user-token")
    const result = handler(url)
    return result instanceof Response ? result : Response.json(result)
  }
}

function grants(ids: string[], appId = "test-app") {
  return { data: { is_valid: true, app_id: appId, granular_scopes: [
    { scope: "pages_show_list", target_ids: ids },
  ] } }
}

test("discovers an explicitly granted Page omitted from me/accounts", async () => {
  mockGraph((url) => {
    if (url.pathname.endsWith("/me/accounts")) return { data: [] }
    if (url.pathname.endsWith("/debug_token")) return grants(["111055421671775"])
    assert.equal(url.pathname, "/v21.0/111055421671775")
    return { id: "111055421671775", name: "360 Automation", access_token: "page-token" }
  })
  const pages = await fetchFacebookPages("user-token")
  assert.equal(pages.length, 1)
  assert.equal(pages[0].name, "360 Automation")
  assert.equal(pages[0].accessToken, "page-token")
})

test("reads later batches, merges missing grants, and avoids duplicate Page requests", async () => {
  mockGraph((url) => {
    if (url.pathname.endsWith("/me/accounts")) {
      if (!url.searchParams.has("after")) return { data: [], paging: {
        next: "https://untrusted.example/never-follow", cursors: { after: "next-batch" },
      } }
      assert.equal(url.searchParams.get("after"), "next-batch")
      return { data: [{ id: "1", name: "First", access_token: "first-token" }] }
    }
    if (url.pathname.endsWith("/debug_token")) return grants(["1", "2", "2"])
    assert.equal(url.pathname, "/v21.0/2")
    return { id: "2", name: "Second", access_token: "second-token" }
  })
  assert.deepEqual((await fetchFacebookPages("user-token")).map((p) => p.id), ["1", "2"])
})

test("does not expose a Page without a Page token or query unrelated grants", async () => {
  mockGraph((url) => {
    if (url.pathname.endsWith("/me/accounts")) return { data: [] }
    if (url.pathname.endsWith("/debug_token")) return { data: {
      is_valid: true, app_id: "test-app", granular_scopes: [
        { scope: "pages_show_list", target_ids: ["1"] },
        { scope: "unrelated", target_ids: ["2"] },
      ],
    } }
    assert.equal(url.pathname, "/v21.0/1")
    return { id: "1", name: "No token" }
  })
  assert.deepEqual(await fetchFacebookPages("user-token"), [])
})

test("keeps listed Pages if supplementary token inspection is unavailable", async () => {
  mockGraph((url) => {
    if (url.pathname.endsWith("/me/accounts")) return { data: [
      { id: "1", name: "First", access_token: "page-token" },
    ] }
    return Response.json({ error: { code: 4 } }, { status: 429 })
  })
  assert.equal((await fetchFacebookPages("user-token")).length, 1)
})

test("ignores grants belonging to another app", async () => {
  mockGraph((url) => {
    if (url.pathname.endsWith("/me/accounts")) return { data: [] }
    assert.ok(url.pathname.endsWith("/debug_token"))
    return grants(["1"], "another-app")
  })
  assert.deepEqual(await fetchFacebookPages("user-token"), [])
})
