import { Injectable, NotFoundException, BadRequestException, ConflictException, UnauthorizedException } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { 
  RegisterUserDto, 
  LoginUserDto, 
  UpdateUserDto,
  UpdateProfileDto,
  ChangePasswordDto,
  ResetPasswordDto,
  CreateAddressDto,
  UpdateAddressDto
} from './dto/user.dto';
import * as bcrypt from 'bcrypt';
import * as jwt from 'jsonwebtoken';
import * as crypto from 'crypto';

const prisma = new PrismaClient();

@Injectable()
export class UserService {
  private readonly jwtSecret = process.env.JWT_SECRET || 'your-secret-key';
  private readonly refreshSecret = process.env.REFRESH_SECRET || 'refresh-secret-key';
  private readonly saltRounds = 10;

  // Authentication
  async register(registerUserDto: RegisterUserDto) {
    // Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { email: registerUserDto.email },
    });

    if (existingUser) {
      throw new ConflictException('User already exists');
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(registerUserDto.password, this.saltRounds);

    // Generate verification token
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const verificationTokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    // Create user
    const user = await prisma.user.create({
      data: {
        email: registerUserDto.email,
        password: hashedPassword,
        firstName: registerUserDto.firstName,
        lastName: registerUserDto.lastName,
        phone: registerUserDto.phone,
        role: registerUserDto.role || 'MEMBER',
        verificationToken,
        verificationTokenExpires,
      },
    });

    // Create user profile
    await prisma.userProfile.create({
      data: {
        userId: user.id,
        experienceLevel: 'beginner',
        receiveEmails: true,
        receivePush: true,
      },
    });

    // Send verification email
    await this.sendVerificationEmail(user.email, verificationToken);

    // Generate tokens
    const tokens = this.generateTokens(user);

    return {
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        emailVerified: user.emailVerified,
      },
      ...tokens,
    };
  }

  async login(loginUserDto: LoginUserDto) {
    const user = await prisma.user.findUnique({
      where: { email: loginUserDto.email },
      include: { profiles: true },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Check if email is verified
    if (!user.emailVerified) {
      throw new UnauthorizedException('Please verify your email address');
    }

    // Check if account is active
    if (user.status !== 'ACTIVE') {
      throw new UnauthorizedException('Account is not active');
    }

    const isPasswordValid = await bcrypt.compare(loginUserDto.password, user.password);

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Update last login
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    // Create session
    const session = await prisma.session.create({
      data: {
        userId: user.id,
        token: this.generateAccessToken(user),
        refreshToken: this.generateRefreshToken(user),
        ipAddress: loginUserDto.ipAddress,
        userAgent: loginUserDto.userAgent,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
      },
    });

    // Generate tokens
    const tokens = this.generateTokens(user);

    return {
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        avatar: user.avatar,
        profile: user.profiles[0],
      },
      ...tokens,
      sessionId: session.id,
    };
  }

  async logout(userId: string, sessionId?: string) {
    if (sessionId) {
      await prisma.session.delete({
        where: { id: sessionId },
      });
    } else {
      await prisma.session.deleteMany({
        where: { userId },
      });
    }

    return { success: true, message: 'Logged out successfully' };
  }

  async refreshToken(refreshToken: string) {
    try {
      const decoded = jwt.verify(refreshToken, this.refreshSecret) as any;
      
      const user = await prisma.user.findUnique({
        where: { id: decoded.userId },
      });

      if (!user) {
        throw new UnauthorizedException('User not found');
      }

      // Check if refresh token is valid in sessions
      const session = await prisma.session.findFirst({
        where: {
          userId: user.id,
          refreshToken,
          expiresAt: { gt: new Date() },
        },
      });

      if (!session) {
        throw new UnauthorizedException('Invalid refresh token');
      }

      const tokens = this.generateTokens(user);

      // Update session with new tokens
      await prisma.session.update({
        where: { id: session.id },
        data: {
          token: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        },
      });

      return tokens;
    } catch (error) {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  // User Management
  async getProfile(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        profiles: true,
        addresses: true,
        subscriptions: {
          where: { status: 'ACTIVE' },
          include: { plan: true },
          take: 1,
        },
        _count: {
          select: {
            bookings: true,
            orders: true,
            reviews: true,
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Remove sensitive data
    const { password, verificationToken, verificationTokenExpires, resetToken, resetTokenExpires, ...safeUser } = user;

    return safeUser;
  }

  async updateProfile(userId: string, updateProfileDto: UpdateProfileDto) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        firstName: updateProfileDto.firstName,
        lastName: updateProfileDto.lastName,
        phone: updateProfileDto.phone,
        avatar: updateProfileDto.avatar,
        bio: updateProfileDto.bio,
        dateOfBirth: updateProfileDto.dateOfBirth,
        gender: updateProfileDto.gender,
      },
    });

    // Update profile if provided
    if (updateProfileDto.profile) {
      await prisma.userProfile.upsert({
        where: { userId },
        update: updateProfileDto.profile,
        create: {
          userId,
          ...updateProfileDto.profile,
        },
      });
    }

    // Remove sensitive data
    const { password, verificationToken, verificationTokenExpires, resetToken, resetTokenExpires, ...safeUser } = updatedUser;

    return safeUser;
  }

  async changePassword(userId: string, changePasswordDto: ChangePasswordDto) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const isCurrentPasswordValid = await bcrypt.compare(changePasswordDto.currentPassword, user.password);

    if (!isCurrentPasswordValid) {
      throw new BadRequestException('Current password is incorrect');
    }

    const hashedNewPassword = await bcrypt.hash(changePasswordDto.newPassword, this.saltRounds);

    await prisma.user.update({
      where: { id: userId },
      data: { password: hashedNewPassword },
    });

    // Invalidate all sessions
    await prisma.session.deleteMany({
      where: { userId },
    });

    return { success: true, message: 'Password changed successfully' };
  }

  async forgotPassword(email: string) {
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      // Don't reveal that user doesn't exist
      return { success: true, message: 'If an account exists, a reset email has been sent' };
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenExpires = new Date(Date.now() + 1 * 60 * 60 * 1000); // 1 hour

    await prisma.user.update({
      where: { id: user.id },
      data: {
        resetToken,
        resetTokenExpires,
      },
    });

    // Send reset email
    await this.sendPasswordResetEmail(user.email, resetToken);

    return { success: true, message: 'Password reset email sent' };
  }

  async resetPassword(resetPasswordDto: ResetPasswordDto) {
    const user = await prisma.user.findFirst({
      where: {
        resetToken: resetPasswordDto.token,
        resetTokenExpires: { gt: new Date() },
      },
    });

    if (!user) {
      throw new BadRequestException('Invalid or expired reset token');
    }

    const hashedPassword = await bcrypt.hash(resetPasswordDto.newPassword, this.saltRounds);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        resetToken: null,
        resetTokenExpires: null,
      },
    });

    // Invalidate all sessions
    await prisma.session.deleteMany({
      where: { userId: user.id },
    });

    return { success: true, message: 'Password reset successfully' };
  }

  async verifyEmail(token: string) {
    const user = await prisma.user.findFirst({
      where: {
        verificationToken: token,
        verificationTokenExpires: { gt: new Date() },
      },
    });

    if (!user) {
      throw new BadRequestException('Invalid or expired verification token');
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerified: true,
        verificationToken: null,
        verificationTokenExpires: null,
      },
    });

    return { success: true, message: 'Email verified successfully' };
  }

  async resendVerificationEmail(email: string) {
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.emailVerified) {
      throw new BadRequestException('Email already verified');
    }

    // Generate new verification token
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const verificationTokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        verificationToken,
        verificationTokenExpires,
      },
    });

    await this.sendVerificationEmail(user.email, verificationToken);

    return { success: true, message: 'Verification email sent' };
  }

  // Address Management
  async createAddress(userId: string, createAddressDto: CreateAddressDto) {
    const address = await prisma.address.create({
      data: {
        userId,
        ...createAddressDto,
        isDefault: createAddressDto.isDefault || false,
      },
    });

    // If this is set as default, update other addresses
    if (createAddressDto.isDefault) {
      await prisma.address.updateMany({
        where: {
          userId,
          id: { not: address.id },
        },
        data: { isDefault: false },
      });
    }

    return address;
  }

  async getAddresses(userId: string) {
    return prisma.address.findMany({
      where: { userId },
      orderBy: [
        { isDefault: 'desc' },
        { createdAt: 'desc' },
      ],
    });
  }

  async updateAddress(userId: string, addressId: string, updateAddressDto: UpdateAddressDto) {
    const address = await prisma.address.findFirst({
      where: {
        id: addressId,
        userId,
      },
    });

    if (!address) {
      throw new NotFoundException('Address not found');
    }

    const updatedAddress = await prisma.address.update({
      where: { id: addressId },
      data: updateAddressDto,
    });

    // If this is set as default, update other addresses
    if (updateAddressDto.isDefault) {
      await prisma.address.updateMany({
        where: {
          userId,
          id: { not: addressId },
        },
        data: { isDefault: false },
      });
    }

    return updatedAddress;
  }

  async deleteAddress(userId: string, addressId: string) {
    const address = await prisma.address.findFirst({
      where: {
        id: addressId,
        userId,
      },
    });

    if (!address) {
      throw new NotFoundException('Address not found');
    }

    // If deleting default address, set another as default
    if (address.isDefault) {
      const anotherAddress = await prisma.address.findFirst({
        where: {
          userId,
          id: { not: addressId },
        },
      });

      if (anotherAddress) {
        await prisma.address.update({
          where: { id: anotherAddress.id },
          data: { isDefault: true },
        });
      }
    }

    await prisma.address.delete({
      where: { id: addressId },
    });

    return { success: true, message: 'Address deleted successfully' };
  }

  // Admin Functions
  async listUsers(filters: any) {
    const {
      role,
      status,
      search,
      emailVerified,
      page = 1,
      limit = 20,
    } = filters;

    const skip = (page - 1) * limit;
    const where: any = {};

    if (role) where.role = role;
    if (status) where.status = status;
    if (emailVerified !== undefined) where.emailVerified = emailVerified;
    if (search) {
      where.OR = [
        { email: { contains: search, mode: 'insensitive' } },
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          phone: true,
          role: true,
          status: true,
          emailVerified: true,
          avatar: true,
          createdAt: true,
          lastLoginAt: true,
          _count: {
            select: {
              bookings: true,
              orders: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.user.count({ where }),
    ]);

    return {
      users,
      pagination: {
        total,
        page: parseInt(page.toString()),
        limit: parseInt(limit.toString()),
        pages: Math.ceil(total / limit),
      },
    };
  }

  async updateUserStatus(userId: string, status: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { status },
    });

    // Invalidate sessions if suspending or deleting
    if (['SUSPENDED', 'DELETED'].includes(status)) {
      await prisma.session.deleteMany({
        where: { userId },
      });
    }

    return updatedUser;
  }

  async getUserStats() {
    const [
      totalUsers,
      activeUsers,
      newUsersToday,
      newUsersThisWeek,
      usersByRole,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { status: 'ACTIVE' } }),
      prisma.user.count({
        where: {
          createdAt: {
            gte: new Date(new Date().setHours(0, 0, 0, 0)),
          },
        },
      }),
      prisma.user.count({
        where: {
          createdAt: {
            gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
          },
        },
      }),
      prisma.user.groupBy({
        by: ['role'],
        _count: true,
      }),
    ]);

    return {
      totalUsers,
      activeUsers,
      newUsersToday,
      newUsersThisWeek,
      usersByRole: usersByRole.reduce((acc, item) => {
        acc[item.role] = item._count;
        return acc;
      }, {}),
    };
  }

  // Helper Methods
  private generateTokens(user: any) {
    const accessToken = this.generateAccessToken(user);
    const refreshToken = this.generateRefreshToken(user);

    return {
      accessToken,
      refreshToken,
      expiresIn: 24 * 60 * 60, // 24 hours in seconds
    };
  }

  private generateAccessToken(user: any): string {
    const payload = {
      userId: user.id,
      email: user.email,
      role: user.role,
    };

    return jwt.sign(payload, this.jwtSecret, { expiresIn: '24h' });
  }

  private generateRefreshToken(user: any): string {
    const payload = {
      userId: user.id,
      email: user.email,
    };

    return jwt.sign(payload, this.refreshSecret, { expiresIn: '7d' });
  }

  private async sendVerificationEmail(email: string, token: string) {
    // Implementation depends on email service
    const verificationUrl = `${process.env.FRONTEND_URL}/verify-email?token=${token}`;
    console.log(`Sending verification email to ${email} with URL: ${verificationUrl}`);
  }

  private async sendPasswordResetEmail(email: string, token: string) {
    // Implementation depends on email service
    const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${token}`;
    console.log(`Sending password reset email to ${email} with URL: ${resetUrl}`);
  }

  async validateToken(token: string) {
    try {
      const decoded = jwt.verify(token, this.jwtSecret) as any;
      
      const user = await prisma.user.findUnique({
        where: { id: decoded.userId },
        select: {
          id: true,
          email: true,
          role: true,
          status: true,
          emailVerified: true,
        },
      });

      if (!user || user.status !== 'ACTIVE') {
        return null;
      }

      return user;
    } catch (error) {
      return null;
    }
  }

  async checkDatabase() {
    try {
      await prisma.$queryRaw`SELECT 1`;
      return 'connected';
    } catch (error) {
      return 'disconnected';
    }
  }
}