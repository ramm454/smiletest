import { Injectable } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

@Injectable()
export class SocialService {
  async shareSession(sessionId: string, userId: string, platform: string, message?: string) {
    const session = await prisma.liveSession.findUnique({
      where: { id: sessionId },
      include: {
        instructor: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    if (!session) {
      throw new Error('Session not found');
    }

    // Generate shareable link
    const shareToken = crypto.randomBytes(16).toString('hex');
    const shareUrl = `${process.env.FRONTEND_URL}/share/${shareToken}`;

    // Create share record
    const share = await prisma.sessionShare.create({
      data: {
        sessionId,
        userId,
        platform,
        shareToken,
        shareUrl,
        message,
        metadata: {
          sessionTitle: session.title,
          instructorName: `${session.instructor.firstName} ${session.instructor.lastName}`,
          timestamp: new Date().toISOString(),
        },
      },
    });

    // Generate social media preview
    const previewData = await this.generateSocialPreview(session);

    return {
      shareId: share.id,
      shareUrl,
      preview: previewData,
      platforms: this.getPlatformShareUrls(shareUrl, session.title, message),
    };
  }

  async joinViaShare(token: string, userId: string) {
    const share = await prisma.sessionShare.findUnique({
      where: { shareToken: token },
      include: {
        session: true,
      },
    });

    if (!share) {
      throw new Error('Invalid share token');
    }

    // Check if session is still available
    if (share.session.status === 'ENDED' || share.session.status === 'CANCELLED') {
      throw new Error('Session has ended');
    }

    // Check if user has already joined
    const existingParticipant = await prisma.liveSessionParticipant.findFirst({
      where: {
        sessionId: share.sessionId,
        userId,
      },
    });

    if (existingParticipant) {
      return {
        session: share.session,
        isNewJoin: false,
        viaShare: true,
      };
    }

    // Check session capacity
    if (share.session.currentParticipants >= share.session.maxParticipants) {
      throw new Error('Session is full');
    }

    // Add user to session
    const participant = await prisma.liveSessionParticipant.create({
      data: {
        sessionId: share.sessionId,
        userId,
        status: 'REGISTERED',
        role: 'ATTENDEE',
        joinedVia: 'SHARE',
        shareId: share.id,
      },
    });

    // Update share stats
    await prisma.sessionShare.update({
      where: { id: share.id },
      data: {
        clickCount: { increment: 1 },
        joinCount: { increment: 1 },
      },
    });

    return {
      session: share.session,
      participant,
      isNewJoin: true,
      viaShare: true,
    };
  }

  async createCommunityPost(sessionId: string, userId: string, postData: any) {
    const session = await prisma.liveSession.findUnique({
      where: { id: sessionId },
    });

    if (!session) {
      throw new Error('Session not found');
    }

    const post = await prisma.communityPost.create({
      data: {
        sessionId,
        userId,
        title: postData.title,
        content: postData.content,
        type: postData.type || 'DISCUSSION',
        tags: postData.tags || [],
        isPublic: postData.isPublic !== false,
        metadata: {
          media: postData.media,
          attachments: postData.attachments,
        },
      },
    });

    // Notify session participants
    await this.notifyParticipantsAboutPost(sessionId, post);

    return post;
  }

  async getSessionCommunity(sessionId: string, page: number = 1, limit: number = 20) {
    const skip = (page - 1) * limit;

    const [posts, total] = await Promise.all([
      prisma.communityPost.findMany({
        where: {
          sessionId,
          isPublic: true,
        },
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              avatar: true,
            },
          },
          comments: {
            take: 3,
            orderBy: { createdAt: 'desc' },
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
          _count: {
            select: {
              comments: true,
              likes: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.communityPost.count({
        where: { sessionId, isPublic: true },
      }),
    ]);

    return {
      posts,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
      },
    };
  }

  async addComment(postId: string, userId: string, commentData: any) {
    const post = await prisma.communityPost.findUnique({
      where: { id: postId },
    });

    if (!post) {
      throw new Error('Post not found');
    }

    const comment = await prisma.postComment.create({
      data: {
        postId,
        userId,
        content: commentData.content,
        parentId: commentData.parentId,
        metadata: {
          mentions: commentData.mentions,
        },
      },
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
    });

    // Notify post author
    if (post.userId !== userId) {
      await this.notifyUser(post.userId, 'new_comment', {
        postId,
        commentId: comment.id,
        commenter: userId,
      });
    }

    return comment;
  }

  async likePost(postId: string, userId: string) {
    const existingLike = await prisma.postLike.findUnique({
      where: {
        postId_userId: {
          postId,
          userId,
        },
      },
    });

    if (existingLike) {
      // Unlike
      await prisma.postLike.delete({
        where: { id: existingLike.id },
      });
      return { liked: false };
    }

    // Like
    await prisma.postLike.create({
      data: {
        postId,
        userId,
      },
    });

    // Notify post author
    const post = await prisma.communityPost.findUnique({
      where: { id: postId },
      select: { userId: true },
    });

    if (post && post.userId !== userId) {
      await this.notifyUser(post.userId, 'post_liked', {
        postId,
        liker: userId,
      });
    }

    return { liked: true };
  }

  async createGroup(sessionId: string, userId: string, groupData: any) {
    const session = await prisma.liveSession.findUnique({
      where: { id: sessionId },
    });

    if (!session) {
      throw new Error('Session not found');
    }

    const group = await prisma.communityGroup.create({
      data: {
        sessionId,
        createdById: userId,
        name: groupData.name,
        description: groupData.description,
        isPublic: groupData.isPublic !== false,
        maxMembers: groupData.maxMembers || 50,
        tags: groupData.tags || [],
      },
    });

    // Add creator as admin
    await prisma.groupMember.create({
      data: {
        groupId: group.id,
        userId,
        role: 'ADMIN',
        joinedAt: new Date(),
      },
    });

    return group;
  }

  async joinGroup(groupId: string, userId: string) {
    const group = await prisma.communityGroup.findUnique({
      where: { id: groupId },
    });

    if (!group) {
      throw new Error('Group not found');
    }

    // Check if already a member
    const existingMember = await prisma.groupMember.findUnique({
      where: {
        groupId_userId: {
          groupId,
          userId,
        },
      },
    });

    if (existingMember) {
      return { joined: false, message: 'Already a member' };
    }

    // Check group capacity
    const memberCount = await prisma.groupMember.count({
      where: { groupId },
    });

    if (memberCount >= group.maxMembers) {
      throw new Error('Group is full');
    }

    // Add user to group
    await prisma.groupMember.create({
      data: {
        groupId,
        userId,
        role: 'MEMBER',
        joinedAt: new Date(),
      },
    });

    // Notify group admins
    const admins = await prisma.groupMember.findMany({
      where: {
        groupId,
        role: 'ADMIN',
      },
      select: { userId: true },
    });

    for (const admin of admins) {
      if (admin.userId !== userId) {
        await this.notifyUser(admin.userId, 'new_group_member', {
          groupId,
          newMember: userId,
        });
      }
    }

    return { joined: true };
  }

  async getSessionGroups(sessionId: string) {
    const groups = await prisma.communityGroup.findMany({
      where: { sessionId },
      include: {
        _count: {
          select: {
            members: true,
          },
        },
        createdBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatar: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return groups;
  }

  private async generateSocialPreview(session: any) {
    const previewDir = path.join(process.cwd(), 'social-previews');
    
    if (!fs.existsSync(previewDir)) {
      fs.mkdirSync(previewDir, { recursive: true });
    }

    const previewId = crypto.randomBytes(8).toString('hex');
    const previewPath = path.join(previewDir, `${previewId}.jpg`);

    // In production, use a library like canvas or sharp to generate image
    // For now, return mock data
    return {
      imageUrl: `${process.env.CDN_URL}/social-previews/${previewId}.jpg`,
      title: session.title,
      description: session.description?.substring(0, 200) || '',
      instructor: `${session.instructor.firstName} ${session.instructor.lastName}`,
      date: session.startTime,
    };
  }

  private getPlatformShareUrls(shareUrl: string, title: string, message?: string) {
    const encodedUrl = encodeURIComponent(shareUrl);
    const encodedTitle = encodeURIComponent(title);
    const encodedMessage = encodeURIComponent(message || title);

    return {
      facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
      twitter: `https://twitter.com/intent/tweet?url=${encodedUrl}&text=${encodedMessage}`,
      linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`,
      whatsapp: `https://wa.me/?text=${encodedMessage}%20${encodedUrl}`,
      telegram: `https://t.me/share/url?url=${encodedUrl}&text=${encodedMessage}`,
    };
  }

  private async notifyParticipantsAboutPost(sessionId: string, post: any) {
    const participants = await prisma.liveSessionParticipant.findMany({
      where: { sessionId },
      select: { userId: true },
    });

    for (const participant of participants) {
      if (participant.userId !== post.userId) {
        await this.notifyUser(participant.userId, 'new_community_post', {
          sessionId,
          postId: post.id,
          author: post.userId,
        });
      }
    }
  }

  private async notifyUser(userId: string, type: string, data: any) {
    // Implementation would use your notification service
    console.log(`Notifying user ${userId} about ${type}:`, data);
  }
}