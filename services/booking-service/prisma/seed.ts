import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Create sample yoga classes
  const yogaClasses = await prisma.yogaClass.createMany({
    data: [
      {
        title: 'Morning Vinyasa Flow',
        description: 'Start your day with energizing flow sequences',
        type: 'vinyasa',
        difficulty: 'intermediate',
        duration: 60,
        capacity: 20,
        booked: 12,
        price: 25.0,
        startTime: new Date(Date.now() + 24 * 60 * 60 * 1000), // Tomorrow
        endTime: new Date(Date.now() + 24 * 60 * 60 * 1000 + 60 * 60 * 1000),
        instructorId: 'demo-instructor-1',
        location: 'Main Studio',
        room: 'Studio A',
        status: 'SCHEDULED',
      },
      {
        title: 'Evening Yin Yoga',
        description: 'Slow-paced yoga for deep relaxation',
        type: 'yin',
        difficulty: 'beginner',
        duration: 75,
        capacity: 15,
        booked: 8,
        price: 30.0,
        startTime: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000), // Day after tomorrow
        endTime: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000 + 75 * 60 * 1000),
        instructorId: 'demo-instructor-2',
        location: 'Main Studio',
        room: 'Studio B',
        status: 'SCHEDULED',
      },
    ],
  });

  // Create sample live sessions
  const liveSessions = await prisma.liveSession.createMany({
    data: [
      {
        title: 'Live Power Yoga',
        description: 'High-intensity power yoga session',
        type: 'power',
        maxParticipants: 50,
        currentParticipants: 35,
        price: 20.0,
        startTime: new Date(Date.now() + 12 * 60 * 60 * 1000), // 12 hours from now
        endTime: new Date(Date.now() + 12 * 60 * 60 * 1000 + 60 * 60 * 1000),
        instructorId: 'demo-instructor-3',
        streamUrl: 'rtmp://live.yogaspa.com/live/power123',
        status: 'LIVE',
      },
    ],
  });

  // Create sample products
  const products = await prisma.product.createMany({
    data: [
      {
        name: 'Premium Yoga Mat',
        description: 'Non-slip, eco-friendly yoga mat',
        sku: 'YM-001',
        price: 49.99,
        stock: 100,
        category: 'Equipment',
        images: ['https://example.com/yoga-mat.jpg'],
        status: 'ACTIVE',
      },
      {
        name: 'Yoga Blocks (Set of 2)',
        description: 'High-density foam yoga blocks',
        sku: 'YB-002',
        price: 29.99,
        stock: 50,
        category: 'Equipment',
        images: ['https://example.com/yoga-blocks.jpg'],
        status: 'ACTIVE',
      },
    ],
  });

  console.log({
    yogaClasses,
    liveSessions,
    products,
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });