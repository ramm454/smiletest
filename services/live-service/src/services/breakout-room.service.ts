import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { CreateBreakoutRoomDto, AssignParticipantDto } from '../dto/breakout-room.dto';

const prisma = new PrismaClient();

@Injectable()
export class BreakoutRoomService {
  async createBreakoutRoom(createDto: CreateBreakoutRoomDto, creatorId: string) {
    const session = await prisma.liveSession.findUnique({
      where: { id: createDto.sessionId },
    });

    if (!session) {
      throw new NotFoundException('Session not found');
    }

    if (!session.breakoutRooms) {
      throw new BadRequestException('Breakout rooms not enabled for this session');
    }

    const breakoutRoom = await prisma.breakoutRoom.create({
      data: {
        sessionId: createDto.sessionId,
        name: createDto.name,
        description: createDto.description,
        maxParticipants: createDto.maxParticipants,
        hostId: createDto.hostId || creatorId,
      },
    });

    // Assign participants if provided
    if (createDto.participantIds && createDto.participantIds.length > 0) {
      await this.assignParticipants(breakoutRoom.id, createDto.participantIds);
    }

    // Notify session participants
    await this.notifyBreakoutRoomCreated(session.id, breakoutRoom);

    return breakoutRoom;
  }

  async assignParticipants(roomId: string, participantIds: string[]) {
    const room = await prisma.breakoutRoom.findUnique({
      where: { id: roomId },
    });

    if (!room) {
      throw new NotFoundException('Breakout room not found');
    }

    if (room.currentParticipants + participantIds.length > room.maxParticipants) {
      throw new BadRequestException('Room capacity exceeded');
    }

    const assignments = await Promise.all(
      participantIds.map(async (userId) => {
        return prisma.breakoutRoomParticipant.upsert({
          where: {
            roomId_userId: {
              roomId,
              userId,
            },
          },
          update: {},
          create: {
            roomId,
            userId,
          },
        });
      })
    );

    // Update participant count
    await prisma.breakoutRoom.update({
      where: { id: roomId },
      data: {
        currentParticipants: {
          increment: participantIds.length,
        },
      },
    });

    return assignments;
  }

  async removeParticipant(roomId: string, userId: string) {
    const participant = await prisma.breakoutRoomParticipant.findUnique({
      where: {
        roomId_userId: {
          roomId,
          userId,
        },
      },
    });

    if (!participant) {
      throw new NotFoundException('Participant not found in this room');
    }

    await prisma.breakoutRoomParticipant.delete({
      where: {
        roomId_userId: {
          roomId,
          userId,
        },
      },
    });

    // Update participant count
    await prisma.breakoutRoom.update({
      where: { id: roomId },
      data: {
        currentParticipants: {
          decrement: 1,
        },
      },
    });

    return { success: true };
  }

  async getSessionBreakoutRooms(sessionId: string) {
    const rooms = await prisma.breakoutRoom.findMany({
      where: {
        sessionId,
        isActive: true,
      },
      include: {
        participants: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                avatar: true,
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    return rooms;
  }

  async closeBreakoutRoom(roomId: string, sessionHostId: string) {
    const room = await prisma.breakoutRoom.findUnique({
      where: { id: roomId },
    });

    if (!room) {
      throw new NotFoundException('Breakout room not found');
    }

    // Check if user has permission
    const session = await prisma.liveSession.findUnique({
      where: { id: room.sessionId },
    });

    if (session.instructorId !== sessionHostId) {
      throw new BadRequestException('Only session host can close breakout rooms');
    }

    const updatedRoom = await prisma.breakoutRoom.update({
      where: { id: roomId },
      data: {
        isActive: false,
      },
    });

    // Notify participants
    await this.notifyBreakoutRoomClosed(roomId);

    return updatedRoom;
  }

  private async notifyBreakoutRoomCreated(sessionId: string, room: any) {
    // Implementation for WebSocket notification
    console.log(`Breakout room ${room.name} created for session ${sessionId}`);
  }

  private async notifyBreakoutRoomClosed(roomId: string) {
    // Implementation for WebSocket notification
    console.log(`Breakout room ${roomId} closed`);
  }
}