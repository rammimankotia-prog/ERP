import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('Start seeding...')

  // 1. Create Agent Tiers
  const tiers = [
    { name: 'SILVER', discountPercentage: 10.0 },
    { name: 'GOLD', discountPercentage: 15.0 },
    { name: 'PLATINUM', discountPercentage: 20.0 },
  ]

  for (const tier of tiers) {
    const upsertedTier = await prisma.agentTier.upsert({
      where: { name: tier.name },
      update: { discountPercentage: tier.discountPercentage },
      create: { name: tier.name, discountPercentage: tier.discountPercentage },
    })
    console.log(`Upserted tier: ${upsertedTier.name}`)
  }

  // 2. Create Default Properties
  const properties = [
    {
      name: 'Hotel Grand Godwin',
      address: 'Plot No. 8502/41, Arakashan Rd, Paharganj, New Delhi',
    },
    {
      name: 'Hotel Godwin Deluxe',
      address: '8501, 15, Arakashan Rd, Paharganj, New Delhi',
    },
  ]

  for (const property of properties) {
    const upsertedProperty = await prisma.property.upsert({
      where: { name: property.name },
      update: { address: property.address },
      create: { name: property.name, address: property.address },
    })
    console.log(`Upserted property: ${upsertedProperty.name}`)
  }

  console.log('Seeding finished.')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
