import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('Seeding HR Branches...')

  const branches = [
    { name: 'Hotel Grand Godwin', prefix: 'GG' },
    { name: 'Hotel Godwin Deluxe', prefix: 'GD' },
    { name: 'Indian Grill', prefix: 'IG' },
    { name: 'Cafe Brownie', prefix: 'CB' },
  ]

  for (const b of branches) {
    const branch = await prisma.branch.upsert({
      where: { name: b.name },
      update: {},
      create: {
        name: b.name,
        prefix: b.prefix,
      },
    })
    console.log(`Upserted Branch: ${branch.name}`)
  }

  console.log('Seeding finished.')
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
