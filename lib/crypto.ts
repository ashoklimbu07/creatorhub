import crypto from "node:crypto"

const ALGORITHM = "aes-256-gcm"

function getKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY
  if (!key) throw new Error("ENCRYPTION_KEY is not set")

  const buf = Buffer.from(key, "base64")
  if (buf.length !== 32) {
    throw new Error("ENCRYPTION_KEY must be a base64-encoded 32-byte key")
  }
  return buf
}

// Stores iv + authTag + ciphertext together (dot-separated base64) so a
// single string column can hold everything needed to decrypt later.
export function encrypt(plaintext: string): string {
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv)
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()])
  const authTag = cipher.getAuthTag()

  return [iv, authTag, encrypted].map((buf) => buf.toString("base64")).join(".")
}

export function decrypt(ciphertext: string): string {
  const [ivB64, tagB64, dataB64] = ciphertext.split(".")
  if (!ivB64 || !tagB64 || !dataB64) {
    throw new Error("Malformed ciphertext")
  }

  const decipher = crypto.createDecipheriv(ALGORITHM, getKey(), Buffer.from(ivB64, "base64"))
  decipher.setAuthTag(Buffer.from(tagB64, "base64"))

  return Buffer.concat([
    decipher.update(Buffer.from(dataB64, "base64")),
    decipher.final(),
  ]).toString("utf8")
}
