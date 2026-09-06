import assert from "node:assert/strict"
import { afterEach, test } from "node:test"
import { decrypt, encrypt } from "./crypto"
import { encodePendingFacebookConnection, decodePendingFacebookConnection } from "./facebook-pending"

const previousKey = process.env.ENCRYPTION_KEY
afterEach(() => {
  if (previousKey === undefined) delete process.env.ENCRYPTION_KEY
  else process.env.ENCRYPTION_KEY = previousKey
})

function fixture() {
  process.env.ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64")
  return {
    userId: "test-user",
    userToken: { accessToken: "x".repeat(256), expiresAt: new Date(Date.now() + 3_600_000).toISOString() },
  }
}

test("11 or more authorized Pages do not increase the pending cookie payload", () => {
  const data = fixture()
  const withPages = { ...data, pages: Array.from({ length: 100 }, (_, i) => ({
    id: String(i), name: `Page ${i}`, accessToken: "p".repeat(256),
  })) }
  const raw = encodePendingFacebookConnection(withPages)
  assert.ok(encodeURIComponent(raw).length < 1000)
  assert.equal(JSON.parse(decrypt(raw)).pages, undefined)
  assert.deepEqual(decodePendingFacebookConnection(raw, data.userId), data)
})

test("rejects another user's cookie and modified ciphertext", () => {
  const data = fixture()
  const raw = encodePendingFacebookConnection(data)
  assert.equal(decodePendingFacebookConnection(raw, "another-user"), null)
  const parts = raw.split(".")
  parts[2] = (parts[2][0] === "A" ? "B" : "A") + parts[2].slice(1)
  assert.equal(decodePendingFacebookConnection(parts.join("."), data.userId), null)
})

test("rejects expired pending sessions, expired tokens, and legacy Page-list cookies", () => {
  const data = fixture()
  for (const payload of [
    { ...data, pendingExpiresAt: Date.now() - 1 },
    { ...data, userToken: { ...data.userToken, expiresAt: "2000-01-01T00:00:00Z" }, pendingExpiresAt: Date.now() + 600_000 },
    { ...data, pages: [] },
  ]) {
    assert.equal(decodePendingFacebookConnection(encrypt(JSON.stringify(payload)), data.userId), null)
  }
})
