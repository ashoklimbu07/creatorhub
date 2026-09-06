import { S3Client, PutBucketCorsCommand } from "@aws-sdk/client-s3"

// Video uploads now PUT straight from the browser to R2 (see lib/storage.ts
// createUploadUrl) instead of proxying through a Next.js route handler, so
// the bucket needs CORS opened up for that origin or the browser blocks the
// PUT before it ever reaches R2. Run this once per environment whenever the
// app's origin changes (new local port, new Vercel domain, custom domain).
//
// Usage: tsx scripts/configure-r2-cors.ts https://your-app.vercel.app [http://localhost:3000 ...]

const origins = process.argv.slice(2)
if (origins.length === 0) {
  console.error(
    "Usage: tsx scripts/configure-r2-cors.ts <origin> [<origin> ...]\n" +
      "Example: tsx scripts/configure-r2-cors.ts https://your-app.vercel.app http://localhost:3000"
  )
  process.exit(1)
}

const BUCKET = process.env.R2_BUCKET_NAME
if (!BUCKET || !process.env.CLOUDFLARE_ACCOUNT_ID) {
  console.error("R2_BUCKET_NAME / CLOUDFLARE_ACCOUNT_ID are not set")
  process.exit(1)
}

const s3 = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
})

async function main() {
  await s3.send(
    new PutBucketCorsCommand({
      Bucket: BUCKET,
      CORSConfiguration: {
        CORSRules: [
          {
            AllowedOrigins: origins,
            AllowedMethods: ["PUT", "GET", "HEAD"],
            AllowedHeaders: ["content-type"],
            MaxAgeSeconds: 3600,
          },
        ],
      },
    })
  )
  console.log(`R2 bucket "${BUCKET}" CORS updated for: ${origins.join(", ")}`)
}

main()
