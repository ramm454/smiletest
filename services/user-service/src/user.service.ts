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
  UpdateAddressDto,
  CreateGuestDto,
  ConvertGuestDto
} from './dto/user.dto';
import * as bcrypt from 'bcrypt';
import * as jwt from 'jsonwebtoken';
import * as crypto from 'crypto';
import * as speakeasy from 'speakeasy';
import * as QRCode from 'qrcode';
import * as Papa from 'papaparse';
import { OAuth2Client } from 'google-auth-library';
import { EventBusService } from '@yogaspa/event-bus';

const prisma = new PrismaClient();

// Add these DTO interfaces (you should create them in your DTO files)
interface SetupMFADto {
  method: 'app' | 'sms' | 'email';
  phoneNumber?: string;
  recoveryEmail?: string;
}

interface VerifyMFADto {
  method: 'app' | 'sms' | 'email' | 'backup';
  code: string;
  deviceName?: string;
}

interface CreateTagDto {
  name: string;
  description?: string;
  color?: string;
}

interface UserFilterDto {
  tags?: string[];
  segment?: 'new' | 'active' | 'inactive';
  dateFrom?: string;
  dateTo?: string;
}

interface ConsentDto {
  consentType: string;
  version: string;
  granted: boolean;
  ipAddress?: string;
  userAgent?: string;
}

interface LinkAccountDto {
  provider: 'google' | 'facebook' | 'apple';
  accessToken: string;
  idToken?: string;
}

enum ExportFormat {
  CSV = 'csv',
  JSON = 'json',
  XML = 'xml'
}

interface ExportUsersDto {
  userIds?: string[];
  dateFrom?: string;
  dateTo?: string;
  format: ExportFormat;
}

interface ImportUsersDto {
  data: string;
  format: ExportFormat;
  updateExisting?: boolean;
  sendWelcomeEmails?: boolean;
}

@Injectable()
export class UserService {
  private readonly jwtSecret = process.env.JWT_SECRET || 'your-secret-key';
  private readonly refreshSecret = process.env.REFRESH_SECRET || 'refresh-secret-key';
  private readonly saltRounds = 10;

  constructor(private readonly eventBus: EventBusService) {}

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

    // Publish user registered event
    await this.eventBus.publishUserEvent('user.registered', {
      userId: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      registeredAt: user.createdAt
    });

    // Publish welcome email event
    await this.eventBus.publishUserEvent('email.welcome', {
      userId: user.id,
      email: user.email,
      name: `${user.firstName} ${user.lastName}`,
      verificationToken
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

    // Publish login event
    await this.eventBus.publishUserEvent('user.logged_in', {
      userId: user.id,
      email: user.email,
      ipAddress: loginUserDto.ipAddress,
      userAgent: loginUserDto.userAgent,
      timestamp: new Date(),
      sessionId: session.id
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
    let sessionsDeleted = 0;
    
    if (sessionId) {
      await prisma.session.delete({
        where: { id: sessionId },
      });
      sessionsDeleted = 1;
    } else {
      const result = await prisma.session.deleteMany({
        where: { userId },
      });
      sessionsDeleted = result.count;
    }

    // Publish logout event
    await this.eventBus.publishUserEvent('user.logged_out', {
      userId,
      sessionId,
      sessionsDeleted,
      timestamp: new Date()
    });

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

      // Publish token refresh event
      await this.eventBus.publishUserEvent('token.refreshed', {
        userId: user.id,
        sessionId: session.id,
        timestamp: new Date()
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

    // Publish profile updated event
    await this.eventBus.publishUserEvent('profile.updated', {
      userId,
      updates: updateProfileDto,
      updatedAt: new Date()
    });

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
    const result = await prisma.session.deleteMany({
      where: { userId },
    });

    // Publish password changed event
    await this.eventBus.publishUserEvent('password.changed', {
      userId,
      sessionsInvalidated: result.count,
      timestamp: new Date()
    });

    // Publish security alert
    await this.eventBus.publishUserEvent('security.alert', {
      userId,
      alertType: 'password_changed',
      severity: 'medium',
      timestamp: new Date(),
      metadata: {
        sessionsInvalidated: result.count
      }
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

    // Publish password reset requested event
    await this.eventBus.publishUserEvent('password.reset_requested', {
      userId: user.id,
      email: user.email,
      resetToken,
      expiresAt: resetTokenExpires
    });

    // Send reset email (via event bus)
    await this.eventBus.publishUserEvent('email.password_reset', {
      userId: user.id,
      email: user.email,
      name: `${user.firstName} ${user.lastName}`,
      resetToken
    });

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
    const result = await prisma.session.deleteMany({
      where: { userId: user.id },
    });

    // Publish password reset event
    await this.eventBus.publishUserEvent('password.reset_completed', {
      userId: user.id,
      email: user.email,
      sessionsInvalidated: result.count,
      timestamp: new Date()
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

    // Publish email verified event
    await this.eventBus.publishUserEvent('email.verified', {
      userId: user.id,
      email: user.email,
      timestamp: new Date()
    });

    // Publish user activation event
    if (user.status === 'PENDING_VERIFICATION') {
      await this.eventBus.publishUserEvent('user.activated', {
        userId: user.id,
        email: user.email,
        timestamp: new Date()
      });
    }

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

    // Publish verification email resent event
    await this.eventBus.publishUserEvent('email.verification_resent', {
      userId: user.id,
      email: user.email,
      verificationToken
    });

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

    // Publish address created event
    await this.eventBus.publishUserEvent('address.created', {
      userId,
      addressId: address.id,
      addressType: address.addressType,
      isDefault: address.isDefault,
      timestamp: new Date()
    });

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

    // Publish address updated event
    await this.eventBus.publishUserEvent('address.updated', {
      userId,
      addressId,
      updates: updateAddressDto,
      timestamp: new Date()
    });

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

    // Publish address deleted event
    await this.eventBus.publishUserEvent('address.deleted', {
      userId,
      addressId,
      addressType: address.addressType,
      timestamp: new Date()
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

  async updateUserStatus(userId: string, status: string, adminId?: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const previousStatus = user.status;
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { status },
    });

    // Invalidate sessions if suspending or deleting
    let sessionsInvalidated = 0;
    if (['SUSPENDED', 'DELETED'].includes(status)) {
      const result = await prisma.session.deleteMany({
        where: { userId },
      });
      sessionsInvalidated = result.count;
    }

    // Publish status changed event
    await this.eventBus.publishUserEvent('user.status_changed', {
      userId,
      previousStatus,
      newStatus: status,
      changedBy: adminId,
      sessionsInvalidated,
      timestamp: new Date()
    });

    // Publish security alert for account suspension/deletion
    if (['SUSPENDED', 'DELETED'].includes(status)) {
      await this.eventBus.publishUserEvent('security.alert', {
        userId,
        alertType: 'account_status_changed',
        severity: 'high',
        timestamp: new Date(),
        metadata: {
          previousStatus,
          newStatus: status,
          changedBy: adminId
        }
      });
    }

    return updatedUser;
  }

  async deleteUser(userId: string, adminId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Soft delete user
    const deletedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        status: 'DELETED',
        deletedAt: new Date(),
        deletedBy: adminId,
        email: `${user.email}_deleted_${Date.now()}` // Anonymize email
      },
    });

    // Invalidate all sessions
    const sessionsResult = await prisma.session.deleteMany({
      where: { userId },
    });

    // Publish user deleted event
    await this.eventBus.publishUserEvent('user.deleted', {
      userId,
      deletedBy: adminId,
      deletedAt: new Date(),
      sessionsInvalidated: sessionsResult.count
    });

    // Publish cascade deletion events
    await this.eventBus.publishUserEvent('cascade.delete', {
      userId,
      services: ['bookings', 'payments', 'notifications', 'reviews'],
      initiatedBy: adminId,
      timestamp: new Date()
    });

    return { success: true, message: 'User deleted' };
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

    // Publish stats updated event (could be used for dashboard updates)
    await this.eventBus.publishUserEvent('stats.updated', {
      statsType: 'users',
      timestamp: new Date(),
      data: {
        totalUsers,
        activeUsers,
        newUsersToday,
        newUsersThisWeek
      }
    });

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

  // ============ SERVICE ENDPOINTS ============
  // This endpoint is called by other services to validate a user
  async getUser(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        status: true,
        emailVerified: true,
        isGuest: true,
        guestExpiresAt: true,
        phone: true,
        avatar: true,
        createdAt: true,
        lastLoginAt: true,
        profiles: {
          select: {
            experienceLevel: true,
            receiveEmails: true,
            receivePush: true,
          }
        }
      }
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Check if guest account is expired
    if (user.isGuest && user.guestExpiresAt && user.guestExpiresAt < new Date()) {
      throw new BadRequestException('Guest account has expired');
    }

    return user;
  }

  // ============ MFA METHODS ============
  async setupMFA(userId: string, dto: SetupMFADto) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    let mfaSettings = await prisma.mFASettings.findUnique({ where: { userId } });
    
    if (!mfaSettings) {
      mfaSettings = await prisma.mFASettings.create({
        data: { userId }
      });
    }

    let updateData: any = {};
    let secret: string | null = null;

    if (dto.method === 'app') {
      // Generate TOTP secret
      secret = speakeasy.generateSecret({
        name: `Yoga Spa:${user.email}`,
        length: 20
      });
      
      updateData.totpSecret = secret.base32;
      updateData.appMFA = true;
    } else if (dto.method === 'sms') {
      if (!dto.phoneNumber) throw new BadRequestException('Phone number required for SMS MFA');
      updateData.phoneNumber = dto.phoneNumber;
      updateData.smsMFA = true;
    } else if (dto.method === 'email') {
      updateData.emailMFA = true;
      if (dto.recoveryEmail) {
        updateData.recoveryEmail = dto.recoveryEmail;
      }
    }

    const updated = await prisma.mFASettings.update({
      where: { userId },
      data: updateData
    });

    // Generate backup codes if enabling any MFA
    if (!mfaSettings.backupCodes || mfaSettings.backupCodes.length === 0) {
      const backupCodes = this.generateBackupCodes();
      await prisma.mFASettings.update({
        where: { userId },
        data: { backupCodes }
      });
    }

    let qrCodeUrl: string | null = null;
    if (secret) {
      qrCodeUrl = await QRCode.toDataURL(secret.otpauth_url);
    }

    // Publish MFA setup event
    await this.eventBus.publishUserEvent('mfa.setup', {
      userId,
      method: dto.method,
      timestamp: new Date()
    });

    return {
      success: true,
      method: dto.method,
      qrCodeUrl,
      backupCodes: updated.backupCodes,
      message: `Setup ${dto.method} MFA. Please verify.`
    };
  }

  async verifyMFA(userId: string, dto: VerifyMFADto) {
    const mfaSettings = await prisma.mFASettings.findUnique({ where: { userId } });
    if (!mfaSettings) throw new BadRequestException('MFA not setup');

    let isValid = false;

    switch (dto.method) {
      case 'app':
        if (!mfaSettings.totpSecret) throw new BadRequestException('App MFA not setup');
        isValid = speakeasy.totp.verify({
          secret: mfaSettings.totpSecret,
          encoding: 'base32',
          token: dto.code,
          window: 1
        });
        break;

      case 'sms':
        // In production, verify against stored code
        // For demo, accept any 6-digit code
        isValid = /^\d{6}$/.test(dto.code);
        break;

      case 'email':
        // Verify email code
        isValid = true; // Implement email code verification
        break;

      case 'backup':
        isValid = mfaSettings.backupCodes.includes(dto.code);
        if (isValid) {
          // Remove used backup code
          const newBackupCodes = mfaSettings.backupCodes.filter(code => code !== dto.code);
          await prisma.mFASettings.update({
            where: { userId },
            data: { backupCodes: newBackupCodes }
          });
        }
        break;
    }

    if (!isValid) throw new UnauthorizedException('Invalid verification code');

    // Mark as verified
    if (dto.method === 'app') {
      await prisma.mFASettings.update({
        where: { userId },
        data: { totpVerified: true }
      });
    } else if (dto.method === 'sms') {
      await prisma.mFASettings.update({
        where: { userId },
        data: { phoneVerified: true }
      });
    }

    // Publish MFA verification event
    await this.eventBus.publishUserEvent('mfa.verified', {
      userId,
      method: dto.method,
      deviceName: dto.deviceName,
      timestamp: new Date()
    });

    // Log activity
    await this.logActivity(userId, 'mfa_verified', {
      method: dto.method,
      device: dto.deviceName
    });

    return { success: true, message: 'MFA verified successfully' };
  }

  private generateBackupCodes(count: number = 10): string[] {
    const codes: string[] = [];
    for (let i = 0; i < count; i++) {
      codes.push(Math.random().toString(36).substring(2, 10).toUpperCase());
    }
    return codes;
  }

  // ============ TAGGING & SEGMENTATION ============
  async createTag(dto: CreateTagDto, userId: string) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (user.role !== 'ADMIN') throw new UnauthorizedException('Admin only');

    const tag = await prisma.userTag.create({
      data: {
        name: dto.name,
        description: dto.description,
        color: dto.color
      }
    });

    // Publish tag created event
    await this.eventBus.publishUserEvent('tag.created', {
      tagId: tag.id,
      name: tag.name,
      createdBy: userId,
      timestamp: new Date()
    });

    return tag;
  }

  async assignTags(userId: string, tagIds: string[]) {
    // Remove existing tags
    await prisma.userTagMap.deleteMany({ where: { userId } });

    // Add new tags
    const assignments = await Promise.all(
      tagIds.map(tagId =>
        prisma.userTagMap.create({
          data: { userId, tagId },
          include: { tag: true }
        })
      )
    );

    // Publish tags assigned event
    await this.eventBus.publishUserEvent('tags.assigned', {
      userId,
      tagIds,
      timestamp: new Date()
    });

    await this.logActivity(userId, 'tags_updated', { tagIds });

    return assignments;
  }

  async segmentUsers(filters: UserFilterDto) {
    const where: any = {};

    if (filters.tags && filters.tags.length > 0) {
      where.tags = {
        some: {
          tagId: { in: filters.tags }
        }
      };
    }

    if (filters.segment) {
      switch (filters.segment) {
        case 'new':
          where.createdAt = {
            gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // Last 30 days
          };
          break;
        case 'active':
          where.lastLoginAt = {
            gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // Last 7 days
          };
          break;
        case 'inactive':
          where.lastLoginAt = {
            lt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // Over 30 days
          };
          break;
      }
    }

    if (filters.dateFrom || filters.dateTo) {
      where.createdAt = {};
      if (filters.dateFrom) where.createdAt.gte = new Date(filters.dateFrom);
      if (filters.dateTo) where.createdAt.lte = new Date(filters.dateTo);
    }

    const users = await prisma.user.findMany({
      where,
      include: {
        tags: {
          include: { tag: true }
        },
        _count: {
          select: {
            bookings: true,
            orders: true
          }
        }
      },
      take: 100
    });

    // Publish segmentation event
    await this.eventBus.publishUserEvent('users.segmented', {
      segment: filters.segment || 'all',
      count: users.length,
      filters,
      timestamp: new Date()
    });

    return {
      segment: filters.segment || 'all',
      count: users.length,
      users
    };
  }

  // ============ CONSENT MANAGEMENT ============
  async recordConsent(userId: string, dto: ConsentDto) {
    const consent = await prisma.userConsent.upsert({
      where: {
        userId_consentType: {
          userId,
          consentType: dto.consentType
        }
      },
      update: {
        version: dto.version,
        granted: dto.granted,
        grantedAt: dto.granted ? new Date() : null,
        revokedAt: !dto.granted ? new Date() : null,
        ipAddress: dto.ipAddress,
        userAgent: dto.userAgent,
        updatedAt: new Date()
      },
      create: {
        userId,
        consentType: dto.consentType,
        version: dto.version,
        granted: dto.granted,
        grantedAt: dto.granted ? new Date() : null,
        ipAddress: dto.ipAddress,
        userAgent: dto.userAgent
      }
    });

    // Publish consent event
    await this.eventBus.publishUserEvent('consent.updated', {
      userId,
      consentType: dto.consentType,
      granted: dto.granted,
      version: dto.version,
      ipAddress: dto.ipAddress,
      timestamp: new Date()
    });

    await this.logActivity(userId, 'consent_updated', {
      consentType: dto.consentType,
      granted: dto.granted,
      version: dto.version
    });

    return consent;
  }

  async getConsentHistory(userId?: string, consentType?: string) {
    const where: any = {};
    if (userId) where.userId = userId;
    if (consentType) where.consentType = consentType;

    const consents = await prisma.userConsent.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true
          }
        }
      },
      orderBy: { updatedAt: 'desc' }
    });

    return consents;
  }

  // ============ ACCOUNT LINKING ============
  async linkAccount(userId: string, dto: LinkAccountDto) {
    let providerData: any;
    
    switch (dto.provider) {
      case 'google':
        providerData = await this.verifyGoogleToken(dto.accessToken, dto.idToken);
        break;
      case 'facebook':
        providerData = await this.verifyFacebookToken(dto.accessToken);
        break;
      // Add other providers...
      default:
        throw new BadRequestException('Provider not supported');
    }

    // Check if account already linked
    const existing = await prisma.linkedAccount.findFirst({
      where: {
        OR: [
          { providerId: providerData.id },
          { userId, provider: dto.provider }
        ]
      }
    });

    if (existing) {
      if (existing.userId !== userId) {
        throw new ConflictException('Account already linked to another user');
      }
      // Update existing
      const updated = await prisma.linkedAccount.update({
        where: { id: existing.id },
        data: {
          accessToken: dto.accessToken,
          refreshToken: providerData.refreshToken,
          expiresAt: providerData.expiresAt,
          updatedAt: new Date()
        }
      });

      // Publish account relinked event
      await this.eventBus.publishUserEvent('account.relinked', {
        userId,
        provider: dto.provider,
        providerId: providerData.id,
        timestamp: new Date()
      });

      return updated;
    }

    const linkedAccount = await prisma.linkedAccount.create({
      data: {
        userId,
        provider: dto.provider,
        providerId: providerData.id,
        email: providerData.email,
        displayName: providerData.name,
        avatarUrl: providerData.picture,
        accessToken: dto.accessToken,
        refreshToken: providerData.refreshToken,
        expiresAt: providerData.expiresAt,
        verified: providerData.email_verified || false
      }
    });

    // Publish account linked event
    await this.eventBus.publishUserEvent('account.linked', {
      userId,
      provider: dto.provider,
      providerId: providerData.id,
      email: providerData.email,
      timestamp: new Date()
    });

    await this.logActivity(userId, 'account_linked', {
      provider: dto.provider,
      providerId: providerData.id
    });

    return linkedAccount;
  }

  private async verifyGoogleToken(accessToken: string, idToken?: string) {
    const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
    
    try {
      const ticket = await client.verifyIdToken({
        idToken: idToken || accessToken,
        audience: process.env.GOOGLE_CLIENT_ID
      });
      
      const payload = ticket.getPayload();
      if (!payload) throw new Error('Invalid token');
      
      return {
        id: payload.sub,
        email: payload.email,
        name: payload.name,
        picture: payload.picture,
        email_verified: payload.email_verified
      };
    } catch (error) {
      throw new UnauthorizedException('Invalid Google token');
    }
  }

  private async verifyFacebookToken(accessToken: string) {
    // Implement Facebook token verification
    throw new BadRequestException('Facebook verification not implemented');
  }

  // ============ IMPORT/EXPORT ============
  async exportUsers(dto: ExportUsersDto, adminId?: string) {
    const where: any = {};
    
    if (dto.userIds && dto.userIds.length > 0) {
      where.id = { in: dto.userIds };
    }
    
    if (dto.dateFrom || dto.dateTo) {
      where.createdAt = {};
      if (dto.dateFrom) where.createdAt.gte = new Date(dto.dateFrom);
      if (dto.dateTo) where.createdAt.lte = new Date(dto.dateTo);
    }

    const users = await prisma.user.findMany({
      where,
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        role: true,
        status: true,
        createdAt: true,
        lastLoginAt: true,
        profiles: {
          select: {
            experienceLevel: true,
            preferredStyles: true
          }
        }
      }
    });

    let data: string;
    
    switch (dto.format) {
      case ExportFormat.CSV:
        data = Papa.unparse(users);
        break;
      case ExportFormat.JSON:
        data = JSON.stringify(users, null, 2);
        break;
      case ExportFormat.XML:
        data = this.convertToXML(users);
        break;
      default:
        data = JSON.stringify(users);
    }

    // Create export record
    await prisma.userActivity.create({
      data: {
        userId: adminId || 'system',
        activityType: 'export_users',
        entityType: 'users',
        description: `Exported ${users.length} users in ${dto.format} format`,
        metadata: {
          format: dto.format,
          count: users.length,
          filters: dto
        }
      }
    });

    // Publish export event
    await this.eventBus.publishUserEvent('users.exported', {
      exportedBy: adminId,
      format: dto.format,
      count: users.length,
      timestamp: new Date(),
      filters: dto
    });

    return {
      format: dto.format,
      count: users.length,
      data,
      filename: `users-export-${new Date().toISOString().split('T')[0]}.${dto.format}`
    };
  }

  async importUsers(dto: ImportUsersDto, adminId: string) {
    let users: any[];
    
    try {
      switch (dto.format) {
        case ExportFormat.CSV:
          const result = Papa.parse(dto.data, { header: true });
          users = result.data;
          break;
        case ExportFormat.JSON:
          users = JSON.parse(dto.data);
          break;
        default:
          throw new BadRequestException('Format not supported for import');
      }
    } catch (error) {
      throw new BadRequestException('Invalid data format');
    }

    const results = {
      total: users.length,
      created: 0,
      updated: 0,
      failed: 0,
      errors: []
    };

    for (const userData of users) {
      try {
        if (dto.updateExisting && userData.email) {
          const existing = await prisma.user.findUnique({
            where: { email: userData.email }
          });
          
          if (existing) {
            await prisma.user.update({
              where: { email: userData.email },
              data: userData
            });
            results.updated++;
            continue;
          }
        }

        await prisma.user.create({
          data: userData
        });
        
        results.created++;
        
        if (dto.sendWelcomeEmails) {
          // Send welcome email via event bus
          await this.eventBus.publishUserEvent('email.welcome', {
            email: userData.email,
            name: `${userData.firstName} ${userData.lastName}`,
            timestamp: new Date()
          });
        }
      } catch (error) {
        results.failed++;
        results.errors.push({
          email: userData.email,
          error: error.message
        });
      }
    }

    // Publish import event
    await this.eventBus.publishUserEvent('users.imported', {
      importedBy: adminId,
      format: dto.format,
      results,
      timestamp: new Date()
    });

    await this.logActivity(adminId, 'import_users', {
      results,
      format: dto.format,
      updateExisting: dto.updateExisting
    });

    return results;
  }

  private convertToXML(data: any[]): string {
    // Simple XML conversion - implement as needed
    return `<users>${data.map(user => 
      `<user>
        <id>${user.id}</id>
        <email>${user.email}</email>
        <firstName>${user.firstName}</firstName>
        <lastName>${user.lastName}</lastName>
      </user>`
    ).join('')}</users>`;
  }

  // ============ ACTIVITY FEED ============
  async getActivityFeed(userId: string, limit: number = 50, offset: number = 0) {
    const activities = await prisma.userActivity.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatar: true
          }
        }
      }
    });

    const total = await prisma.userActivity.count({ where: { userId } });

    // Group by date
    const grouped = activities.reduce((acc, activity) => {
      const date = activity.createdAt.toISOString().split('T')[0];
      if (!acc[date]) acc[date] = [];
      acc[date].push(activity);
      return acc;
    }, {});

    return {
      activities: grouped,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total
      }
    };
  }

  private async logActivity(userId: string, activityType: string, metadata?: any) {
    const activity = await prisma.userActivity.create({
      data: {
        userId,
        activityType,
        metadata,
        createdAt: new Date()
      }
    });

    // Publish activity event
    await this.eventBus.publishUserEvent('activity.logged', {
      userId,
      activityType,
      timestamp: new Date(),
      metadata
    });

    return activity;
  }

  // ============ GUEST USER METHODS ============
  async createGuestSession(dto: CreateGuestDto) {
    const sessionId = dto.sessionId || crypto.randomUUID();
    const temporaryId = `guest_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const guestSession = await prisma.guestSession.create({
      data: {
        sessionId,
        temporaryId,
        email: dto.email,
        firstName: dto.firstName,
        lastName: dto.lastName,
        ipAddress: dto.ipAddress,
        userAgent: dto.userAgent,
        deviceId: dto.deviceId,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
        lastActivityAt: new Date()
      }
    });
    
    // Create a temporary user record
    const guestUser = await prisma.user.create({
      data: {
        email: dto.email || `${temporaryId}@guest.yogaspa.com`,
        firstName: dto.firstName || 'Guest',
        lastName: dto.lastName || 'User',
        password: await bcrypt.hash(crypto.randomBytes(32).toString('hex'), this.saltRounds),
        role: 'GUEST',
        status: 'ACTIVE',
        isGuest: true,
        guestExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        emailVerified: false
      }
    });
    
    // Publish guest session created event
    await this.eventBus.publishUserEvent('guest.session_created', {
      sessionId: guestSession.sessionId,
      temporaryId: guestSession.temporaryId,
      guestUserId: guestUser.id,
      timestamp: new Date()
    });
    
    return {
      sessionId: guestSession.sessionId,
      temporaryId: guestSession.temporaryId,
      guestUserId: guestUser.id,
      token: this.generateGuestToken(guestSession, guestUser),
      expiresAt: guestSession.expiresAt
    };
  }

  async convertGuestToUser(sessionId: string, dto: ConvertGuestDto) {
    const guestSession = await prisma.guestSession.findUnique({
      where: { sessionId },
      include: { user: true }
    });
    
    if (!guestSession) {
      throw new NotFoundException('Guest session not found');
    }
    
    if (guestSession.expiresAt < new Date()) {
      throw new BadRequestException('Guest session expired');
    }
    
    // Check if email already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: dto.email }
    });
    
    if (existingUser) {
      throw new ConflictException('Email already registered');
    }
    
    // Update guest user to full user
    const updatedUser = await prisma.user.update({
      where: { id: guestSession.user.id },
      data: {
        email: dto.email,
        password: await bcrypt.hash(dto.password, this.saltRounds),
        firstName: dto.firstName || guestSession.firstName,
        lastName: dto.lastName || guestSession.lastName,
        role: 'MEMBER',
        isGuest: false,
        guestExpiresAt: null,
        emailVerified: false,
        // Transfer preferences if requested
        preferences: dto.keepPreferences ? guestSession.preferences : {}
      }
    });
    
    // Update guest session
    await prisma.guestSession.update({
      where: { sessionId },
      data: {
        convertedUserId: updatedUser.id,
        conversionToken: crypto.randomBytes(32).toString('hex')
      }
    });
    
    // Send verification email via event bus
    const verificationToken = crypto.randomBytes(32).toString('hex');
    await prisma.user.update({
      where: { id: updatedUser.id },
      data: {
        verificationToken,
        verificationTokenExpires: new Date(Date.now() + 24 * 60 * 60 * 1000)
      }
    });
    
    await this.eventBus.publishUserEvent('email.verification', {
      userId: updatedUser.id,
      email: updatedUser.email,
      name: `${updatedUser.firstName} ${updatedUser.lastName}`,
      verificationToken
    });
    
    // Transfer cart items if requested (call to booking service)
    if (dto.keepCart && guestSession.cartItems) {
      await this.transferGuestCart(guestSession.temporaryId, updatedUser.id);
    }
    
    // Generate tokens
    const tokens = this.generateTokens(updatedUser);
    
    // Create session
    await prisma.session.create({
      data: {
        userId: updatedUser.id,
        token: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
      }
    });
    
    // Publish guest conversion event
    await this.eventBus.publishUserEvent('guest.converted', {
      sessionId,
      temporaryId: guestSession.temporaryId,
      userId: updatedUser.id,
      email: updatedUser.email,
      timestamp: new Date(),
      transferredCart: dto.keepCart,
      transferredPreferences: dto.keepPreferences
    });
    
    // Cleanup guest session
    await prisma.guestSession.delete({
      where: { sessionId }
    });
    
    return {
      user: {
        id: updatedUser.id,
        email: updatedUser.email,
        firstName: updatedUser.firstName,
        lastName: updatedUser.lastName,
        role: updatedUser.role,
        isGuest: false
      },
      ...tokens,
      message: 'Account created successfully. Please verify your email.'
    };
  }

  async getGuestSession(sessionId: string) {
    const guestSession = await prisma.guestSession.findUnique({
      where: { sessionId },
      include: { user: true }
    });
    
    if (!guestSession) {
      throw new NotFoundException('Guest session not found');
    }
    
    // Update last activity
    await prisma.guestSession.update({
      where: { sessionId },
      data: { lastActivityAt: new Date() }
    });
    
    return {
      sessionId: guestSession.sessionId,
      temporaryId: guestSession.temporaryId,
      email: guestSession.email,
      firstName: guestSession.firstName,
      lastName: guestSession.lastName,
      preferences: guestSession.preferences,
      cartItems: guestSession.cartItems,
      expiresAt: guestSession.expiresAt,
      guestUserId: guestSession.user?.id
    };
  }

  async updateGuestPreferences(sessionId: string, preferences: any) {
    const guestSession = await prisma.guestSession.findUnique({
      where: { sessionId }
    });
    
    if (!guestSession) {
      throw new NotFoundException('Guest session not found');
    }
    
    const updated = await prisma.guestSession.update({
      where: { sessionId },
      data: {
        preferences,
        lastActivityAt: new Date()
      }
    });
    
    // Also update associated user if exists
    if (guestSession.userId) {
      await prisma.user.update({
        where: { id: guestSession.userId },
        data: { preferences }
      });
    }
    
    // Publish guest preferences updated event
    await this.eventBus.publishUserEvent('guest.preferences_updated', {
      sessionId,
      temporaryId: guestSession.temporaryId,
      preferences,
      timestamp: new Date()
    });
    
    return updated;
  }

  async saveGuestCart(sessionId: string, cartItems: any[]) {
    const guestSession = await prisma.guestSession.findUnique({
      where: { sessionId }
    });
    
    if (!guestSession) {
      throw new NotFoundException('Guest session not found');
    }
    
    const updated = await prisma.guestSession.update({
      where: { sessionId },
      data: {
        cartItems: cartItems,
        lastActivityAt: new Date()
      }
    });
    
    // Publish guest cart updated event
    await this.eventBus.publishUserEvent('guest.cart_updated', {
      sessionId,
      temporaryId: guestSession.temporaryId,
      itemCount: cartItems.length,
      timestamp: new Date()
    });
    
    return updated;
  }

  private generateGuestToken(guestSession: any, guestUser: any): string {
    const payload = {
      sessionId: guestSession.sessionId,
      temporaryId: guestSession.temporaryId,
      guestUserId: guestUser.id,
      type: 'guest'
    };
    
    return jwt.sign(payload, this.jwtSecret, { expiresIn: '24h' });
  }

  private async transferGuestCart(temporaryId: string, userId: string) {
    // This would call the booking/ecommerce service
    // Publish cart transfer event
    await this.eventBus.publishUserEvent('cart.transferred', {
      fromTemporaryId: temporaryId,
      toUserId: userId,
      timestamp: new Date()
    });
    
    return true;
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