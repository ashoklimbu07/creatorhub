import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  DeleteObjectCommand,
  ListObjectsV2Command,
} from "@aws-sdk/client-s3"
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"

const BUCKET = process.env.R2_BUCKET_NAME!

const s3 = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
})

export type PresignedUpload = {
  uploadUrl: string
  key: string
}

// Vercel (and most serverless hosts) cap request bodies well under typical
// video sizes, so the browser uploads straight to R2 with a presigned PUT
// instead of routing the file through a Next.js route handler. The bucket
// stays private — this key is not a browser-usable URL — callers must
// resolve a display URL via getSignedVideoUrl() at render time.
export async function createUploadUrl(
  userId: string,
  fileName: string,
  contentType: string,
  expiresIn = 900
): Promise<PresignedUpload> {
  const ext = fileName.includes(".") ? fileName.slice(fileName.lastIndexOf(".")) : ""
  const key = `videos/${userId}/${crypto.randomUUID()}${ext}`

  const uploadUrl = await getSignedUrl(
    s3,
    new PutObjectCommand({ Bucket: BUCKET, Key: key, ContentType: contentType }),
    { expiresIn }
  )

  return { uploadUrl, key }
}

export async function createThumbnailUploadUrl(
  userId: string,
  expiresIn = 900
): Promise<PresignedUpload> {
  const key = `thumbnails/${userId}/${crypto.randomUUID()}.jpg`
  const uploadUrl = await getSignedUrl(
    s3,
    new PutObjectCommand({ Bucket: BUCKET, Key: key, ContentType: "image/jpeg" }),
    { expiresIn }
  )

  return { uploadUrl, key }
}

// Confirms the browser's direct-to-R2 upload actually landed and returns the
// real object size — the client-reported size is never trusted for billing
// or quota accounting. Returns null if the object doesn't exist (upload
// never completed).
export async function getObjectSize(key: string): Promise<number | null> {
  try {
    const head = await s3.send(new HeadObjectCommand({ Bucket: BUCKET, Key: key }))
    return head.ContentLength ?? null
  } catch (err) {
    if (err instanceof Error && err.name === "NotFound") return null
    throw err
  }
}

export async function getSignedVideoUrl(
  key: string,
  expiresIn = 3600
): Promise<string> {
  return getSignedUrl(s3, new GetObjectCommand({ Bucket: BUCKET, Key: key }), {
    expiresIn,
  })
}

export async function getSignedAssetUrl(value: string, expiresIn = 3600): Promise<string> {
  if (/^https?:\/\//i.test(value)) return value
  return getSignedVideoUrl(value, expiresIn)
}

export async function deleteFile(key: string): Promise<void> {
  await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }))
}

// Ground-truth bucket contents, keyed by object key -> size in bytes.
export async function listVideoObjects(): Promise<Map<string, number>> {
  const sizeByKey = new Map<string, number>()
  let continuationToken: string | undefined

  do {
    const page = await s3.send(
      new ListObjectsV2Command({
        Bucket: BUCKET,
        Prefix: "videos/",
        ContinuationToken: continuationToken,
      })
    )
    for (const obj of page.Contents ?? []) {
      if (obj.Key && obj.Size != null) {
        sizeByKey.set(obj.Key, obj.Size)
      }
    }
    continuationToken = page.NextContinuationToken
  } while (continuationToken)

  return sizeByKey
}
