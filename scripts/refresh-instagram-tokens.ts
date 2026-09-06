import { prisma } from "../lib/prisma"
import { encrypt, decrypt } from "../lib/crypto"
import { refreshLongLivedInstagramToken } from "../services/platforms/meta-oauth"

// Instagram long-lived tokens last ~60 days. instagram.service.ts already
// refreshes opportunistically at publish time, but an account that goes
// quiet for two months would otherwise silently expire — run this
// periodically (e.g. daily cron) to catch those.
const REFRESH_BUFFER_MS = 7 * 24 * 60 * 60 * 1000

async function main() {
  const connections = await prisma.platformConnection.findMany({
    where: {
      platform: "INSTAGRAM",
      expiresAt: { lt: new Date(Date.now() + REFRESH_BUFFER_MS) },
    },
  })

  console.log(`Found ${connections.length} Instagram connection(s) due for refresh.`)

  for (const connection of connections) {
    try {
      const refreshed = await refreshLongLivedInstagramToken(decrypt(connection.accessToken))
      await prisma.platformConnection.update({
        where: { id: connection.id },
        data: {
          accessToken: encrypt(refreshed.accessToken),
          refreshToken: encrypt(refreshed.accessToken),
          expiresAt: refreshed.expiresAt,
        },
      })
      console.log(`Refreshed Instagram token for connection ${connection.id}.`)
    } catch (err) {
      console.error(`Failed to refresh Instagram token for connection ${connection.id}:`, err)
    }
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (err) => {
    console.error(err)
    await prisma.$disconnect()
    process.exit(1)
  })
