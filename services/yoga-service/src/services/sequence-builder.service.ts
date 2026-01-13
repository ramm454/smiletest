import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { CreateSequenceDto, UpdateSequenceDto } from '../dto/class-sequence.dto';

const prisma = new PrismaClient();

@Injectable()
export class SequenceBuilderService {
  // Sequence Management
  async createSequence(createSequenceDto: CreateSequenceDto, instructorId: string) {
    // Validate poses exist
    const poseIds = createSequenceDto.poses.map(p => p.poseId);
    const poses = await prisma.yogaPose.findMany({
      where: {
        id: { in: poseIds },
        isActive: true,
      },
    });

    if (poses.length !== poseIds.length) {
      throw new BadRequestException('One or more poses not found');
    }

    // Calculate total duration
    const calculatedDuration = createSequenceDto.poses.reduce(
      (total, pose) => total + pose.duration,
      0,
    ) / 60; // Convert to minutes

    if (Math.abs(calculatedDuration - createSequenceDto.totalDuration) > 5) {
      throw new BadRequestException('Total duration does not match sum of pose durations');
    }

    const sequence = await prisma.classSequence.create({
      data: {
        name: createSequenceDto.name,
        description: createSequenceDto.description,
        type: createSequenceDto.type,
        difficulty: createSequenceDto.difficulty,
        totalDuration: createSequenceDto.totalDuration,
        focusArea: createSequenceDto.focusArea,
        isTemplate: createSequenceDto.isTemplate,
        instructorId,
        isPublic: true,
        usageCount: 0,
        averageRating: 0,
        sequencePoses: {
          create: createSequenceDto.poses.map(pose => ({
            poseId: pose.poseId,
            order: pose.order,
            duration: pose.duration,
            transitionInstructions: pose.transitionInstructions,
            breathPattern: pose.breathPattern,
          })),
        },
      },
      include: {
        sequencePoses: {
          include: {
            pose: true,
          },
          orderBy: { order: 'asc' },
        },
        instructor: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatar: true,
          },
        },
      },
    });

    return sequence;
  }

  async getSequence(sequenceId: string) {
    const sequence = await prisma.classSequence.findUnique({
      where: { id: sequenceId },
      include: {
        sequencePoses: {
          include: {
            pose: true,
          },
          orderBy: { order: 'asc' },
        },
        instructor: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatar: true,
            bio: true,
          },
        },
        _count: {
          select: {
            classUses: true,
          },
        },
      },
    });

    if (!sequence) {
      throw new NotFoundException('Sequence not found');
    }

    return sequence;
  }

  async listSequences(filters: any) {
    const {
      type,
      difficulty,
      instructorId,
      focusArea,
      isTemplate,
      search,
      page = 1,
      limit = 20,
    } = filters;

    const skip = (page - 1) * limit;
    const where: any = {};

    if (type) where.type = type;
    if (difficulty) where.difficulty = difficulty;
    if (instructorId) where.instructorId = instructorId;
    if (focusArea) where.focusArea = focusArea;
    if (isTemplate !== undefined) where.isTemplate = isTemplate;
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { focusArea: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [sequences, total] = await Promise.all([
      prisma.classSequence.findMany({
        where,
        include: {
          instructor: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              avatar: true,
            },
          },
          _count: {
            select: {
              sequencePoses: true,
              classUses: true,
            },
          },
        },
        orderBy: { usageCount: 'desc' },
        skip,
        take: limit,
      }),
      prisma.classSequence.count({ where }),
    ]);

    return {
      sequences,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
      },
    };
  }

  async updateSequence(sequenceId: string, instructorId: string, updateDto: UpdateSequenceDto) {
    const sequence = await prisma.classSequence.findFirst({
      where: {
        id: sequenceId,
        instructorId,
      },
    });

    if (!sequence) {
      throw new NotFoundException('Sequence not found or unauthorized');
    }

    const updatedSequence = await prisma.classSequence.update({
      where: { id: sequenceId },
      data: updateDto,
    });

    return updatedSequence;
  }

  async deleteSequence(sequenceId: string, instructorId: string) {
    const sequence = await prisma.classSequence.findFirst({
      where: {
        id: sequenceId,
        instructorId,
      },
    });

    if (!sequence) {
      throw new NotFoundException('Sequence not found or unauthorized');
    }

    // Check if sequence is used in any classes
    const classUses = await prisma.yogaClass.count({
      where: { sequenceId },
    });

    if (classUses > 0) {
      throw new BadRequestException('Cannot delete sequence that is used in classes');
    }

    await prisma.sequencePose.deleteMany({
      where: { sequenceId },
    });

    await prisma.classSequence.delete({
      where: { id: sequenceId },
    });

    return { success: true, message: 'Sequence deleted successfully' };
  }

  async useSequenceInClass(sequenceId: string, classId: string) {
    const sequence = await prisma.classSequence.findUnique({
      where: { id: sequenceId },
    });

    if (!sequence) {
      throw new NotFoundException('Sequence not found');
    }

    // Update usage count
    const updatedSequence = await prisma.classSequence.update({
      where: { id: sequenceId },
      data: {
        usageCount: { increment: 1 },
      },
    });

    // Link sequence to class
    await prisma.yogaClass.update({
      where: { id: classId },
      data: { sequenceId },
    });

    return updatedSequence;
  }

  async rateSequence(sequenceId: string, userId: string, rating: number, review?: string) {
    if (rating < 1 || rating > 5) {
      throw new BadRequestException('Rating must be between 1 and 5');
    }

    const sequence = await prisma.classSequence.findUnique({
      where: { id: sequenceId },
    });

    if (!sequence) {
      throw new NotFoundException('Sequence not found');
    }

    // Check if user has used this sequence
    const hasUsed = await prisma.yogaClass.findFirst({
      where: {
        sequenceId,
        bookings: {
          some: {
            userId,
            status: 'COMPLETED',
          },
        },
      },
    });

    if (!hasUsed) {
      throw new BadRequestException('You must complete a class using this sequence to rate it');
    }

    // Create or update rating
    const existingRating = await prisma.sequenceRating.findUnique({
      where: {
        userId_sequenceId: {
          userId,
          sequenceId,
        },
      },
    });

    if (existingRating) {
      await prisma.sequenceRating.update({
        where: { id: existingRating.id },
        data: { rating, review },
      });
    } else {
      await prisma.sequenceRating.create({
        data: {
          userId,
          sequenceId,
          rating,
          review,
        },
      });
    }

    // Recalculate average rating
    const ratings = await prisma.sequenceRating.findMany({
      where: { sequenceId },
      select: { rating: true },
    });

    const averageRating = ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length;

    await prisma.classSequence.update({
      where: { id: sequenceId },
      data: { averageRating },
    });

    return { success: true, averageRating };
  }

  async generateSequenceFromTemplate(templateId: string, instructorId: string, modifications?: any) {
    const template = await prisma.classSequence.findFirst({
      where: {
        id: templateId,
        isTemplate: true,
      },
      include: {
        sequencePoses: {
          include: {
            pose: true,
          },
          orderBy: { order: 'asc' },
        },
      },
    });

    if (!template) {
      throw new NotFoundException('Template not found');
    }

    // Create a new sequence based on template
    const newSequence = await prisma.classSequence.create({
      data: {
        name: `${template.name} (Custom)`,
        description: template.description,
        type: template.type,
        difficulty: template.difficulty,
        totalDuration: template.totalDuration,
        focusArea: template.focusArea,
        isTemplate: false,
        instructorId,
        isPublic: false,
        sequencePoses: {
          create: template.sequencePoses.map(sp => ({
            poseId: sp.poseId,
            order: sp.order,
            duration: sp.duration,
            transitionInstructions: sp.transitionInstructions,
            breathPattern: sp.breathPattern,
          })),
        },
      },
      include: {
        sequencePoses: {
          include: {
            pose: true,
          },
        },
      },
    });

    return newSequence;
  }

  async getSequenceTemplates(filters: any) {
    const where: any = { isTemplate: true };

    if (filters.difficulty) where.difficulty = filters.difficulty;
    if (filters.type) where.type = filters.type;
    if (filters.focusArea) where.focusArea = filters.focusArea;

    const templates = await prisma.classSequence.findMany({
      where,
      include: {
        instructor: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatar: true,
          },
        },
        _count: {
          select: {
            sequencePoses: true,
          },
        },
      },
      orderBy: { usageCount: 'desc' },
    });

    return templates;
  }
}