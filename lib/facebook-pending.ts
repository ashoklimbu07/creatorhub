import { decrypt, encrypt } from "./crypto"

export const FACEBOOK_PENDING_MAX_AGE_SECONDS = 10 * 60

interface PendingFacebookConnection {
  userId: string
  userToken: { accessToken: string; expiresAt: string }
}

// Never serialize Page lists/tokens here: the encrypted cookie would exceed
// browser limits for users who authorize several Pages.
export function encodePendingFacebookConnection(data: PendingFacebookConnection): string {
  return encrypt(JSON.stringify({
    userId: data.userId,
    userToken: data.userToken,
    pendingExpiresAt: Date.now() + FACEBOOK_PENDING_MAX_AGE_SECONDS * 1000,
  }))
}

export function decodePendingFacebookConnection(
  raw: string, userId: string
): PendingFacebookConnection | null {
  try {
    const data = JSON.parse(decrypt(raw))
    if (data.userId !== userId || typeof data.pendingExpiresAt !== "number" ||
        data.pendingExpiresAt <= Date.now() ||
        typeof data.userToken?.accessToken !== "string" || !data.userToken.accessToken ||
        typeof data.userToken.expiresAt !== "string" ||
        !(Date.parse(data.userToken.expiresAt) > Date.now())) return null
    return { userId: data.userId, userToken: data.userToken }
  } catch {
    return null
  }
}
