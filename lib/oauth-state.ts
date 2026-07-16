import crypto from "node:crypto"

const STATE_MAX_AGE_MS = 10 * 60 * 1000

function getStateSecret(): string {
  const secret = process.env.OAUTH_STATE_SECRET
  if (!secret) throw new Error("OAUTH_STATE_SECRET is not set")
  return secret
}

function sign(data: string): string {
  return crypto.createHmac("sha256", getStateSecret()).update(data).digest("base64url")
}

// Signed, timestamped state param for OAuth CSRF protection — encodes the
// initiating userId so the callback route can verify it without a session
// lookup at the provider redirect step.
export function signState(userId: string): string {
  const payload = Buffer.from(JSON.stringify({ userId, ts: Date.now() }), "utf8").toString(
    "base64url"
  )
  return `${payload}.${sign(payload)}`
}

export function verifyState(state: string): { userId: string } | null {
  const [payload, signature] = state.split(".")
  if (!payload || !signature) return null

  const expected = sign(payload)
  const sigBuf = Buffer.from(signature)
  const expBuf = Buffer.from(expected)
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return null
  }

  try {
    const { userId, ts } = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"))
    if (typeof userId !== "string" || typeof ts !== "number") return null
    if (Date.now() - ts > STATE_MAX_AGE_MS) return null
    return { userId }
  } catch {
    return null
  }
}
