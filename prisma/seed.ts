import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

async function main() {
  await prisma.user.upsert({
    where: { email: "demo@creatorhub.dev" },
    update: {},
    create: {
      id: "00000000-0000-0000-0000-000000000001",
      email: "demo@creatorhub.dev",
      name: "Demo User",
    },
  })
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
  })
