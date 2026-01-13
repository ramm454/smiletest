import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Create yoga poses
  const poses = await prisma.yogaPose.createMany({
    data: [
      {
        name: 'Mountain Pose',
        sanskritName: 'Tadasana',
        category: 'standing',
        difficulty: 'beginner',
        benefits: ['Improves posture', 'Strengthens legs', 'Reduces flat feet'],
        contraindications: ['Low blood pressure'],
        instructions: 'Stand with feet together, distribute weight evenly...',
        duration: 60,
        isActive: true,
      },
      {
        name: 'Downward Facing Dog',
        sanskritName: 'Adho Mukha Svanasana',
        category: 'inversion',
        difficulty: 'beginner',
        benefits: ['Strengthens arms and legs', 'Stretches shoulders and hamstrings', 'Calms the brain'],
        contraindications: ['Carpal tunnel syndrome', 'High blood pressure'],
        instructions: 'Start on hands and knees, lift hips up and back...',
        duration: 90,
        isActive: true,
      },
      {
        name: 'Warrior II',
        sanskritName: 'Virabhadrasana II',
        category: 'standing',
        difficulty: 'intermediate',
        benefits: ['Strengthens legs and ankles', 'Stretches groins and chest', 'Increases stamina'],
        contraindications: ['Diarrhea', 'High blood pressure'],
        instructions: 'Stand with feet wide apart, turn right foot out...',
        duration: 120,
        isActive: true,
      },
    ],
  });

  // Create a sequence
  const sequence = await prisma.classSequence.create({
    data: {
      name: 'Morning Energizer',
      description: 'A sequence to wake up and energize your body',
      type: 'morning',
      difficulty: 'beginner',
      totalDuration: 30,
      focusArea: 'full body',
      isTemplate: true,
      isPublic: true,
      sequencePoses: {
        create: [
          {
            poseId: (await prisma.yogaPose.findFirst({ where: { name: 'Mountain Pose' } }))!.id,
            order: 1,
            duration: 60,
            breathPattern: 'Deep breathing',
          },
          {
            poseId: (await prisma.yogaPose.findFirst({ where: { name: 'Downward Facing Dog' } }))!.id,
            order: 2,
            duration: 90,
            transitionInstructions: 'Step back from Mountain Pose',
          },
        ],
      },
    },
  });

  console.log('Seed data created successfully');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });