import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { CreateCertificationDto, EnrollInCertificationDto, UpdateCertificationProgressDto } from '../dto/certification.dto';

const prisma = new PrismaClient();

@Injectable()
export class CertificationService {
  // Certification Management
  async createCertification(createCertificationDto: CreateCertificationDto, instructorId: string) {
    // Generate certification code
    const certificationCode = `CERT-${Date.now().toString(36).toUpperCase()}`;

    const certification = await prisma.certification.create({
      data: {
        ...createCertificationDto,
        certificationCode,
        createdBy: instructorId,
      },
    });

    return certification;
  }

  async getCertification(certificationId: string) {
    const certification = await prisma.certification.findUnique({
      where: { id: certificationId },
      include: {
        _count: {
          select: {
            enrollments: true,
          },
        },
      },
    });

    if (!certification) {
      throw new NotFoundException('Certification not found');
    }

    return certification;
  }

  async listCertifications(filters: any) {
    const {
      type,
      isActive,
      search,
      page = 1,
      limit = 20,
    } = filters;

    const skip = (page - 1) * limit;
    const where: any = {};

    if (type) where.type = type;
    if (isActive !== undefined) where.isActive = isActive;
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { certificationCode: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [certifications, total] = await Promise.all([
      prisma.certification.findMany({
        where,
        include: {
          _count: {
            select: {
              enrollments: {
                where: { status: 'active' },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.certification.count({ where }),
    ]);

    return {
      certifications,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
      },
    };
  }

  async enrollInCertification(enrollDto: EnrollInCertificationDto) {
    const certification = await prisma.certification.findUnique({
      where: { id: enrollDto.certificationId },
    });

    if (!certification) {
      throw new NotFoundException('Certification not found');
    }

    if (!certification.isActive) {
      throw new BadRequestException('Certification is not active');
    }

    // Check if already enrolled
    const existingEnrollment = await prisma.certificationEnrollment.findFirst({
      where: {
        certificationId: enrollDto.certificationId,
        userId: enrollDto.userId,
        status: { in: ['pending', 'active'] },
      },
    });

    if (existingEnrollment) {
      throw new BadRequestException('Already enrolled in this certification');
    }

    const enrollment = await prisma.certificationEnrollment.create({
      data: {
        certificationId: enrollDto.certificationId,
        userId: enrollDto.userId,
        status: 'pending',
        enrolledDate: new Date(),
        progress: {},
        overallProgress: 0,
      },
    });

    // TODO: Process payment if required
    if (certification.price > 0) {
      // Process payment
      // This would integrate with payment service
    }

    // Update enrollment count
    await prisma.certification.update({
      where: { id: enrollDto.certificationId },
      data: {
        enrolledCount: { increment: 1 },
      },
    });

    return enrollment;
  }

  async updateEnrollmentProgress(updateDto: UpdateCertificationProgressDto) {
    const enrollment = await prisma.certificationEnrollment.findUnique({
      where: { id: updateDto.enrollmentId },
      include: {
        certification: true,
      },
    });

    if (!enrollment) {
      throw new NotFoundException('Enrollment not found');
    }

    // Update progress
    const progress = enrollment.progress || {};
    progress[updateDto.moduleId] = updateDto.progressPercentage;

    // Calculate overall progress
    const moduleCount = enrollment.certification.modules.length;
    const totalProgress = Object.values(progress).reduce((sum, p) => sum + p, 0);
    const overallProgress = Math.min(100, (totalProgress / moduleCount));

    const updatedEnrollment = await prisma.certificationEnrollment.update({
      where: { id: updateDto.enrollmentId },
      data: {
        progress,
        overallProgress,
        ...(updateDto.completed && overallProgress >= 100 ? {
          status: 'completed',
          completedDate: new Date(),
        } : {}),
      },
    });

    // Update certification stats if completed
    if (updatedEnrollment.status === 'completed') {
      await prisma.certification.update({
        where: { id: enrollment.certificationId },
        data: {
          completedCount: { increment: 1 },
        },
      });
    }

    return updatedEnrollment;
  }

  async getUserEnrollments(userId: string) {
    const enrollments = await prisma.certificationEnrollment.findMany({
      where: { userId },
      include: {
        certification: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return enrollments;
  }

  async generateCertificate(enrollmentId: string) {
    const enrollment = await prisma.certificationEnrollment.findUnique({
      where: { id: enrollmentId },
      include: {
        certification: true,
      },
    });

    if (!enrollment) {
      throw new NotFoundException('Enrollment not found');
    }

    if (enrollment.status !== 'completed') {
      throw new BadRequestException('Certification not completed');
    }

    if (enrollment.certificateUrl) {
      return { certificateUrl: enrollment.certificateUrl };
    }

    // Generate certificate
    // This would integrate with a certificate generation service
    const certificateUrl = `/certificates/${enrollmentId}.pdf`;

    await prisma.certificationEnrollment.update({
      where: { id: enrollmentId },
      data: { certificateUrl },
    });

    return { certificateUrl };
  }

  async getCertificationStats(certificationId: string) {
    const certification = await prisma.certification.findUnique({
      where: { id: certificationId },
      include: {
        _count: {
          select: {
            enrollments: true,
          },
        },
        enrollments: {
          select: {
            status: true,
            overallProgress: true,
            enrolledDate: true,
            completedDate: true,
          },
        },
      },
    });

    if (!certification) {
      throw new NotFoundException('Certification not found');
    }

    const stats = {
      totalEnrollments: certification._count.enrollments,
      activeEnrollments: certification.enrollments.filter(e => e.status === 'active').length,
      completedEnrollments: certification.enrollments.filter(e => e.status === 'completed').length,
      averageProgress: certification.enrollments.reduce((sum, e) => sum + e.overallProgress, 0) / certification.enrollments.length,
      completionRate: certification._count.enrollments > 0 
        ? (certification.enrollments.filter(e => e.status === 'completed').length / certification._count.enrollments) * 100 
        : 0,
    };

    return { certification, stats };
  }
}