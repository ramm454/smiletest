import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { CreatePoseDto, UpdatePoseDto, PoseFilterDto } from '../dto/pose-library.dto';

const prisma = new PrismaClient();

@Injectable()
export class PoseLibraryService {
  // Pose Management
  async createPose(createPoseDto: CreatePoseDto, instructorId?: string) {
    const pose = await prisma.yogaPose.create({
      data: {
        ...createPoseDto,
        createdBy: instructorId,
        isActive: true,
      },
    });

    return pose;
  }

  async getPose(poseId: string) {
    const pose = await prisma.yogaPose.findUnique({
      where: { id: poseId },
      include: {
        _count: {
          select: {
            sequences: true,
          },
        },
      },
    });

    if (!pose) {
      throw new NotFoundException('Pose not found');
    }

    return pose;
  }

  async listPoses(filters: PoseFilterDto) {
    const { category, difficulty, search, page = 1, limit = 20 } = filters;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (category) where.category = category;
    if (difficulty) where.difficulty = difficulty;
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { sanskritName: { contains: search, mode: 'insensitive' } },
        { benefits: { has: search } },
      ];
    }
    where.isActive = true;

    const [poses, total] = await Promise.all([
      prisma.yogaPose.findMany({
        where,
        include: {
          _count: {
            select: {
              sequences: true,
            },
          },
        },
        orderBy: { name: 'asc' },
        skip,
        take: limit,
      }),
      prisma.yogaPose.count({ where }),
    ]);

    return {
      poses,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
      },
    };
  }

  async updatePose(poseId: string, updatePoseDto: UpdatePoseDto) {
    const pose = await prisma.yogaPose.findUnique({
      where: { id: poseId },
    });

    if (!pose) {
      throw new NotFoundException('Pose not found');
    }

    const updatedPose = await prisma.yogaPose.update({
      where: { id: poseId },
      data: updatePoseDto,
    });

    return updatedPose;
  }

  async deletePose(poseId: string) {
    const pose = await prisma.yogaPose.findUnique({
      where: { id: poseId },
    });

    if (!pose) {
      throw new NotFoundException('Pose not found');
    }

    // Soft delete
    const deletedPose = await prisma.yogaPose.update({
      where: { id: poseId },
      data: { isActive: false },
    });

    return { success: true, message: 'Pose deleted successfully' };
  }

  async getPoseCategories() {
    const categories = await prisma.yogaPose.groupBy({
      by: ['category'],
      where: { isActive: true },
      _count: {
        id: true,
      },
    });

    return categories.map(cat => ({
      category: cat.category,
      count: cat._count.id,
    }));
  }

  async getPoseStats(poseId: string) {
    const pose = await prisma.yogaPose.findUnique({
      where: { id: poseId },
      include: {
        _count: {
          select: {
            sequences: true,
            poseProgress: true,
          },
        },
      },
    });

    if (!pose) {
      throw new NotFoundException('Pose not found');
    }

    // Get difficulty distribution
    const difficultyStats = await prisma.yogaPose.groupBy({
      by: ['difficulty'],
      where: { category: pose.category },
      _count: {
        id: true,
      },
    });

    return {
      pose,
      stats: {
        usedInSequences: pose._count.sequences,
        studentsPracticed: pose._count.poseProgress,
        difficultyDistribution: difficultyStats.reduce((acc, stat) => {
          acc[stat.difficulty] = stat._count.id;
          return acc;
        }, {}),
      },
    };
  }
}