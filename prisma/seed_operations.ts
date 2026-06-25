import { prisma } from '../src/lib/prisma';

async function main() {
  // Create a User (Manager)
  const manager = await prisma.user.upsert({
    where: { email: 'ajay@example.com' },
    update: {},
    create: {
      name: 'Ajay Manager',
      email: 'ajay@example.com',
      passwordHash: 'hashed',
      role: 'TOUR_MANAGER',
    },
  });

  // Create a Quotation
  const quote = await prisma.quotation.create({
    data: {
      quoteNumber: 'Q-' + Date.now(),
      guestName: 'John Doe',
      totalB2cPrice: 50000,
      totalB2bPrice: 45000,
      status: 'ACCEPTED',
      tours: {
        create: {
          startDate: new Date(),
          endDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // 4 days tour
        }
      }
    },
    include: { tours: true }
  });

  console.log('Seeded active tour for John Doe');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
