import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import {
  CreateGroupBookingDto,
  UpdateGroupBookingDto,
  AddGroupMemberDto,
  GroupMemberDto,
} from '../dto/group-booking.dto';
import * as crypto from 'crypto';

@Injectable()
export class GroupBookingService {
  private prisma = new PrismaClient();

  async createGroupBooking(createDto: CreateGroupBookingDto) {
    // Validate capacity and availability
    await this.validateGroupAvailability(createDto);

    // Calculate pricing
    const pricing = await this.calculateGroupPricing(createDto);

    // Generate invitation token
    const invitationToken = this.generateInvitationToken();

    const groupBooking = await this.prisma.groupBooking.create({
      data: {
        userId: createDto.userId,
        classId: createDto.classId,
        sessionId: createDto.sessionId,
        startTime: new Date(createDto.startTime),
        endTime: new Date(createDto.endTime),
        timezone: createDto.timezone || 'UTC',
        groupName: createDto.groupName || `Group Booking - ${new Date().toLocaleDateString()}`,
        pricingType: createDto.pricingType,
        groupPrice: createDto.groupPrice,
        minParticipants: createDto.minParticipants,
        maxParticipants: createDto.maxParticipants,
        discountPercentage: createDto.discountPercentage,
        notes: createDto.notes,
        specialRequests: createDto.specialRequests,
        source: createDto.source || 'WEB',
        requireAllPayment: createDto.requireAllPayment || false,
        totalAmount: pricing.totalAmount,
        amountPaid: 0,
        amountDue: pricing.totalAmount,
        status: 'PENDING',
        invitationToken,
        invitationExpiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
        members: {
          create: createDto.members.map((member, index) => ({
            email: member.email,
            firstName: member.firstName,
            lastName: member.lastName,
            phone: member.phone,
            price: member.price || pricing.memberPrices[index] || pricing.averagePrice,
            amountPaid: 0,
            amountDue: member.price || pricing.memberPrices[index] || pricing.averagePrice,
            status: 'INVITED',
            isPrimary: member.isPrimary || (index === 0),
            invitationToken: this.generateMemberToken(),
            invitedAt: new Date(),
          })),
        },
      },
      include: {
        members: true,
      },
    });

    // Send invitations
    await this.sendGroupInvitations(groupBooking);

    // Update member counts
    await this.updateMemberCounts(groupBooking.id);

    return groupBooking;
  }

  async getGroupBooking(id: string) {
    const groupBooking = await this.prisma.groupBooking.findUnique({
      where: { id },
      include: {
        members: {
          include: {
            booking: {
              include: {
                yogaClass: true,
                liveSession: true,
              },
            },
          },
        },
        bookings: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
              },
            },
          },
        },
      },
    });

    if (!groupBooking) {
      throw new NotFoundException('Group booking not found');
    }

    return groupBooking;
  }

  async updateGroupBooking(id: string, updateDto: UpdateGroupBookingDto) {
    const groupBooking = await this.prisma.groupBooking.findUnique({
      where: { id },
    });

    if (!groupBooking) {
      throw new NotFoundException('Group booking not found');
    }

    const updated = await this.prisma.groupBooking.update({
      where: { id },
      data: updateDto,
    });

    // If members were updated, recalculate pricing
    if (updateDto.members) {
      await this.recalculateGroupPricing(id);
    }

    return updated;
  }

  async addGroupMember(id: string, memberDto: AddGroupMemberDto) {
    const groupBooking = await this.prisma.groupBooking.findUnique({
      where: { id },
    });

    if (!groupBooking) {
      throw new NotFoundException('Group booking not found');
    }

    // Check max participants
    const currentMembers = await this.prisma.groupMember.count({
      where: { groupBookingId: id, status: { not: 'CANCELLED' } },
    });

    if (groupBooking.maxParticipants && currentMembers >= groupBooking.maxParticipants) {
      throw new BadRequestException('Maximum participants reached');
    }

    const memberPrice = await this.calculateMemberPrice(groupBooking, memberDto);

    const member = await this.prisma.groupMember.create({
      data: {
        groupBookingId: id,
        email: memberDto.email,
        firstName: memberDto.firstName,
        lastName: memberDto.lastName,
        phone: memberDto.phone,
        price: memberPrice,
        amountDue: memberPrice,
        status: 'INVITED',
        invitationToken: this.generateMemberToken(),
        invitedAt: new Date(),
      },
    });

    // Send invitation
    await this.sendMemberInvitation(member);

    // Update group totals
    await this.recalculateGroupPricing(id);

    return member;
  }

  async confirmGroupMember(invitationToken: string, userId?: string) {
    const member = await this.prisma.groupMember.findFirst({
      where: { invitationToken },
      include: { groupBooking: true },
    });

    if (!member) {
      throw new NotFoundException('Invitation not found or expired');
    }

    if (member.status !== 'INVITED') {
      throw new BadRequestException('Invitation already processed');
    }

    const updatedMember = await this.prisma.groupMember.update({
      where: { id: member.id },
      data: {
        status: 'CONFIRMED',
        userId: userId,
        respondedAt: new Date(),
      },
    });

    // Create individual booking for confirmed member
    await this.createMemberBooking(member);

    // Update group status
    await this.updateGroupStatus(member.groupBookingId);

    return updatedMember;
  }

  async generatePaymentLink(groupBookingId: string, memberId?: string) {
    const groupBooking = await this.prisma.groupBooking.findUnique({
      where: { id: groupBookingId },
      include: { members: true },
    });

    if (!groupBooking) {
      throw new NotFoundException('Group booking not found');
    }

    if (memberId) {
      const member = groupBooking.members.find(m => m.id === memberId);
      if (!member) {
        throw new NotFoundException('Group member not found');
      }

      return {
        type: 'individual',
        memberId: member.id,
        amount: member.amountDue,
        paymentLink: `${process.env.FRONTEND_URL}/group-payment/${groupBookingId}/${memberId}`,
      };
    }

    return {
      type: 'group',
      groupBookingId: groupBooking.id,
      amount: groupBooking.amountDue,
      paymentLink: `${process.env.FRONTEND_URL}/group-payment/${groupBookingId}`,
    };
  }

  async processGroupPayment(groupBookingId: string, paymentData: any) {
    const groupBooking = await this.prisma.groupBooking.findUnique({
      where: { id: groupBookingId },
      include: { members: true },
    });

    if (!groupBooking) {
      throw new NotFoundException('Group booking not found');
    }

    // Process payment through payment service
    const paymentResult = await this.processPayment(groupBooking, paymentData);

    if (paymentResult.success) {
      await this.prisma.groupBooking.update({
        where: { id: groupBookingId },
        data: {
          amountPaid: { increment: paymentData.amount },
          amountDue: { decrement: paymentData.amount },
        },
      });

      // If full amount paid, confirm all members
      const updatedGroup = await this.prisma.groupBooking.findUnique({
        where: { id: groupBookingId },
      });

      if (updatedGroup.amountDue <= 0) {
        await this.confirmAllMembers(groupBookingId);
      }
    }

    return paymentResult;
  }

  private async validateGroupAvailability(createDto: CreateGroupBookingDto) {
    if (createDto.classId) {
      const yogaClass = await this.prisma.yogaClass.findUnique({
        where: { id: createDto.classId },
      });

      if (!yogaClass) {
        throw new NotFoundException('Class not found');
      }

      const totalParticipants = createDto.members.length;
      const availableSpots = yogaClass.capacity - yogaClass.booked;

      if (totalParticipants > availableSpots) {
        throw new BadRequestException(
          `Only ${availableSpots} spots available, but ${totalParticipants} requested`
        );
      }

      if (createDto.minParticipants && totalParticipants < createDto.minParticipants) {
        throw new BadRequestException(
          `Minimum ${createDto.minParticipants} participants required`
        );
      }

      if (yogaClass.maxGroupSize && totalParticipants > yogaClass.maxGroupSize) {
        throw new BadRequestException(
          `Maximum group size is ${yogaClass.maxGroupSize} participants`
        );
      }
    }
  }

  private async calculateGroupPricing(createDto: CreateGroupBookingDto) {
    let basePrice = 0;
    const memberCount = createDto.members.length;

    if (createDto.classId) {
      const yogaClass = await this.prisma.yogaClass.findUnique({
        where: { id: createDto.classId },
      });
      basePrice = yogaClass?.price || 0;
    } else if (createDto.sessionId) {
      const session = await this.prisma.liveSession.findUnique({
        where: { id: createDto.sessionId },
      });
      basePrice = session?.price || 0;
    }

    let totalAmount = 0;
    const memberPrices: number[] = [];

    switch (createDto.pricingType) {
      case 'FIXED':
        totalAmount = createDto.groupPrice || basePrice * memberCount;
        const averagePrice = totalAmount / memberCount;
        createDto.members.forEach(() => memberPrices.push(averagePrice));
        break;

      case 'TIERED':
        // Implement tiered pricing logic
        const tier1 = Math.min(5, memberCount);
        const tier2 = Math.max(0, memberCount - 5);
        
        totalAmount = (tier1 * basePrice) + (tier2 * basePrice * 0.8); // 20% discount after 5
        const tier1Price = basePrice;
        const tier2Price = basePrice * 0.8;
        
        createDto.members.forEach((_, index) => {
          memberPrices.push(index < 5 ? tier1Price : tier2Price);
        });
        break;

      case 'PER_PERSON':
      default:
        totalAmount = basePrice * memberCount;
        createDto.members.forEach(() => memberPrices.push(basePrice));
        break;
    }

    // Apply group discount
    const discountAmount = totalAmount * (createDto.discountPercentage / 100);
    totalAmount -= discountAmount;

    // Adjust individual prices proportionally
    const adjustedPrices = memberPrices.map(price => {
      return price * (totalAmount / (basePrice * memberCount));
    });

    return {
      basePrice,
      totalAmount,
      averagePrice: totalAmount / memberCount,
      memberPrices: adjustedPrices,
      discountAmount,
    };
  }

  private async calculateMemberPrice(groupBooking: any, memberDto: AddGroupMemberDto) {
    if (memberDto.price) {
      return memberDto.price;
    }

    const memberCount = await this.prisma.groupMember.count({
      where: { groupBookingId: groupBooking.id, status: { not: 'CANCELLED' } },
    }) + 1;

    switch (groupBooking.pricingType) {
      case 'FIXED':
        return groupBooking.totalAmount / (memberCount + 1);
      
      case 'TIERED':
        // Recalculate with new member count
        const newTotal = this.calculateTieredPrice(memberCount + 1);
        return newTotal / (memberCount + 1);
      
      default:
        let basePrice = 0;
        if (groupBooking.classId) {
          const yogaClass = await this.prisma.yogaClass.findUnique({
            where: { id: groupBooking.classId },
          });
          basePrice = yogaClass?.price || 0;
        }
        return basePrice;
    }
  }

  private calculateTieredPrice(memberCount: number): number {
    const basePrice = 50; // Example base price
    const tier1 = Math.min(5, memberCount);
    const tier2 = Math.max(0, memberCount - 5);
    return (tier1 * basePrice) + (tier2 * basePrice * 0.8);
  }

  private generateInvitationToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  private generateMemberToken(): string {
    return crypto.randomBytes(16).toString('hex');
  }

  private async sendGroupInvitations(groupBooking: any) {
    // Implementation for sending email/SMS invitations
    console.log('Sending group invitations for booking:', groupBooking.id);
    
    for (const member of groupBooking.members) {
      await this.sendMemberInvitation(member);
    }
  }

  private async sendMemberInvitation(member: any) {
    const invitationLink = `${process.env.FRONTEND_URL}/group-invitation/${member.invitationToken}`;
    
    console.log(`Sending invitation to ${member.email}: ${invitationLink}`);
    // Actual email/SMS sending implementation would go here
  }

  private async createMemberBooking(member: any) {
    const groupBooking = await this.prisma.groupBooking.findUnique({
      where: { id: member.groupBookingId },
    });

    const booking = await this.prisma.booking.create({
      data: {
        userId: member.userId || null,
        classId: groupBooking.classId,
        sessionId: groupBooking.sessionId,
        startTime: groupBooking.startTime,
        endTime: groupBooking.endTime,
        timezone: groupBooking.timezone,
        participants: 1,
        participantNames: member.firstName ? [`${member.firstName} ${member.lastName}`] : [],
        guestEmails: [member.email],
        basePrice: member.price,
        totalAmount: member.price,
        currency: 'USD',
        status: 'CONFIRMED',
        paymentStatus: member.amountPaid >= member.price ? 'COMPLETED' : 'PENDING',
        source: groupBooking.source,
        groupBookingId: groupBooking.id,
        groupMemberId: member.id,
      },
    });

    // Update member with booking reference
    await this.prisma.groupMember.update({
      where: { id: member.id },
      data: { bookingId: booking.id },
    });

    return booking;
  }

  private async updateGroupStatus(groupBookingId: string) {
    const members = await this.prisma.groupMember.findMany({
      where: { groupBookingId },
    });

    const confirmedCount = members.filter(m => m.status === 'CONFIRMED').length;
    const totalCount = members.filter(m => m.status !== 'CANCELLED').length;

    let status = 'PENDING';
    if (confirmedCount >= totalCount) {
      status = 'CONFIRMED';
    } else if (confirmedCount > 0) {
      status = 'PARTIAL';
    }

    await this.prisma.groupBooking.update({
      where: { id: groupBookingId },
      data: {
        status,
        confirmedMembers: confirmedCount,
      },
    });
  }

  private async recalculateGroupPricing(groupBookingId: string) {
    const groupBooking = await this.prisma.groupBooking.findUnique({
      where: { id: groupBookingId },
      include: { members: true },
    });

    const activeMembers = groupBooking.members.filter(m => m.status !== 'CANCELLED');
    const totalAmount = activeMembers.reduce((sum, member) => sum + member.price, 0);
    const amountPaid = activeMembers.reduce((sum, member) => sum + member.amountPaid, 0);

    await this.prisma.groupBooking.update({
      where: { id: groupBookingId },
      data: {
        totalAmount,
        amountPaid,
        amountDue: totalAmount - amountPaid,
      },
    });
  }

  private async updateMemberCounts(groupBookingId: string) {
    const counts = await this.prisma.groupMember.groupBy({
      by: ['status'],
      where: { groupBookingId },
      _count: true,
    });

    const countsMap = counts.reduce((acc, item) => {
      acc[item.status] = item._count;
      return acc;
    }, {});

    await this.prisma.groupBooking.update({
      where: { id: groupBookingId },
      data: {
        confirmedMembers: countsMap.CONFIRMED || 0,
        pendingMembers: (countsMap.INVITED || 0) + (countsMap.PENDING || 0),
        cancelledMembers: countsMap.CANCELLED || 0,
      },
    });
  }

  private async confirmAllMembers(groupBookingId: string) {
    const members = await this.prisma.groupMember.findMany({
      where: {
        groupBookingId,
        status: { in: ['INVITED', 'PENDING'] },
      },
    });

    for (const member of members) {
      await this.prisma.groupMember.update({
        where: { id: member.id },
        data: {
          status: 'CONFIRMED',
          respondedAt: new Date(),
        },
      });

      await this.createMemberBooking(member);
    }

    await this.prisma.groupBooking.update({
      where: { id: groupBookingId },
      data: { status: 'CONFIRMED' },
    });
  }

  private async processPayment(groupBooking: any, paymentData: any) {
    // Integration with payment service (Stripe, PayPal, etc.)
    console.log('Processing payment for group booking:', groupBooking.id);
    
    // Mock implementation
    return {
      success: true,
      transactionId: `txn_${Date.now()}`,
      amount: paymentData.amount,
      timestamp: new Date(),
    };
  }
}