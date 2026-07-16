import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  ListObjectsV2Command,
} from "@aws-sdk/client-s3"
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"

export type UploadResult = {
  url: string
  size: number
}

const BUCKET = process.env.R2_BUCKET_NAME!

const s3 = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
})

// The bucket is private. `url` here is the R2 object key, not a browser-usable
// URL — callers must resolve a display URL via getSignedVideoUrl() at render time.
export async function uploadFile(file: File): Promise<UploadResult> {
  const ext = file.name.includes(".") ? file.name.slice(file.name.lastIndexOf(".")) : ""
  const key = `videos/${crypto.randomUUID()}${ext}`

  const buffer = Buffer.from(await file.arrayBuffer())

  await s3.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: buffer,
      ContentType: file.type,
    })
  )

  return {
    url: key,
    size: buffer.byteLength,
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
