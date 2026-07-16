import { prisma } from "../lib/prisma"
import { enforceStorageQuota, gb } from "../lib/storage-quota"

async function main() {
  const result = await enforceStorageQuota()
  console.log(`R2 bucket usage: ${gb(result.usageBytes)} GB`)

  if (result.deletedCount === 0) {
    console.log("Under the 9.00 GB threshold — nothing to do.")
    return
  }

  console.log(
    `Over the 9.00 GB threshold. Deleted ${result.deletedCount} oldest video(s).`
  )
  console.log(`New usage: ~${gb(result.finalUsageBytes)} GB`)
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (err) => {
    console.error(err)
    await prisma.$disconnect()
    process.exit(1)
  })
