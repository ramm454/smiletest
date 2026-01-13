import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { TrackPracticeDto, StudentGoalDto } from '../dto/progress-tracking.dto';

const prisma = new PrismaClient();

@Injectable()
export class ProgressTrackingService {
  // Practice Tracking
  async trackPractice(trackPracticeDto: TrackPracticeDto) {
    const practiceLog = await prisma.studentPracticeLog.create({
      data: {
        userId: trackPracticeDto.userId,
        classId: trackPracticeDto.classId,
        sequenceId: trackPracticeDto.sequenceId,
        duration: trackPracticeDto.duration,
        practiceType: trackPracticeDto.practiceType,
        focusArea: trackPracticeDto.focusArea,
        caloriesBurned: trackPracticeDto.caloriesBurned,
        heartRateAvg: trackPracticeDto.heartRateAvg,
        posesPracticed: trackPracticeDto.posesPracticed,
        notes: trackPracticeDto.notes,
        practiceDate: new Date(),
      },
    });

    // Update pose progress for each pose practiced
    if (trackPracticeDto.posesPracticed && trackPracticeDto.posesPracticed.length > 0) {
      await this.updatePoseProgress(
        trackPracticeDto.userId,
        trackPracticeDto.posesPracticed,
        trackPracticeDto.duration,
      );
    }

    // Update streak
    await this.updatePracticeStreak(trackPracticeDto.userId);

    return practiceLog;
  }

  async updatePoseProgress(userId: string, poseIds: string[], duration: number) {
    for (const poseId of poseIds) {
      const existingProgress = await prisma.poseProgress.findFirst({
        where: {
          userId,
          poseId,
        },
      });

      if (existingProgress) {
        await prisma.poseProgress.update({
          where: { id: existingProgress.id },
          data: {
            practiceCount: { increment: 1 },
            totalDuration: { increment: duration },
            // Auto-increase comfort level after certain practice count
            comfortLevel: this.calculateNewComfortLevel(
              existingProgress.comfortLevel,
              existingProgress.practiceCount + 1,
            ),
            mastered: existingProgress.practiceCount + 1 >= 20 && existingProgress.comfortLevel >= 4,
            ...(existingProgress.practiceCount + 1 >= 20 && existingProgress.comfortLevel >= 4 && !existingProgress.mastered
              ? { masteredDate: new Date() }
              : {}),
          },
        });
      } else {
        await prisma.poseProgress.create({
          data: {
            userId,
            poseId,
            practiceCount: 1,
            totalDuration: duration,
            comfortLevel: 1,
            mastered: false,
          },
        });
      }
    }
  }

  private calculateNewComfortLevel(currentLevel: number, practiceCount: number): number {
    if (practiceCount >= 20) return Math.min(5, currentLevel + 0.5);
    if (practiceCount >= 10) return Math.min(4, currentLevel + 0.3);
    if (practiceCount >= 5) return Math.min(3, currentLevel + 0.2);
    return Math.min(2, currentLevel + 0.1);
  }

  async updatePracticeStreak(userId: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    // Check if practiced today
    const practicedToday = await prisma.studentPracticeLog.findFirst({
      where: {
        userId,
        practiceDate: {
          gte: today,
        },
      },
    });

    if (!practicedToday) {
      return; // No practice today, streak remains same
    }

    // Get streak record
    let streak = await prisma.practiceStreak.findFirst({
      where: { userId },
    });

    if (!streak) {
      streak = await prisma.practiceStreak.create({
        data: {
          userId,
          currentStreak: 1,
          longestStreak: 1,
          lastPracticeDate: today,
        },
      });
      return streak;
    }

    // Check if practiced yesterday
    const practicedYesterday = await prisma.studentPracticeLog.findFirst({
      where: {
        userId,
        practiceDate: {
          gte: yesterday,
          lt: today,
        },
      },
    });

    if (practicedYesterday) {
      // Continue streak
      const newStreak = streak.currentStreak + 1;
      await prisma.practiceStreak.update({
        where: { id: streak.id },
        data: {
          currentStreak: newStreak,
          longestStreak: Math.max(streak.longestStreak, newStreak),
          lastPracticeDate: today,
        },
      });
    } else {
      // Start new streak
      await prisma.practiceStreak.update({
        where: { id: streak.id },
        data: {
          currentStreak: 1,
          lastPracticeDate: today,
        },
      });
    }
  }

  // Goal Management
  async createGoal(goalDto: StudentGoalDto) {
    const goal = await prisma.studentGoal.create({
      data: {
        userId: goalDto.userId,
        goalType: goalDto.goalType,
        target: goalDto.target,
        targetDate: goalDto.targetDate ? new Date(goalDto.targetDate) : null,
        currentProgress: goalDto.currentProgress,
        status: 'active',
      },
    });

    return goal;
  }

  async updateGoalProgress(goalId: string, progress: number, userId: string) {
    const goal = await prisma.studentGoal.findFirst({
      where: {
        id: goalId,
        userId,
      },
    });

    if (!goal) {
      throw new NotFoundException('Goal not found');
    }

    const updatedGoal = await prisma.studentGoal.update({
      where: { id: goalId },
      data: {
        currentProgress: progress,
        ...(progress >= 100 ? { status: 'completed' } : {}),
      },
    });

    return updatedGoal;
  }

  async getUserGoals(userId: string) {
    const goals = await prisma.studentGoal.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    return goals;
  }

  // Progress Analytics
  async getUserProgressStats(userId: string, timeframe: string = 'month') {
    const now = new Date();
    let startDate: Date;

    switch (timeframe) {
      case 'week':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'month':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case 'quarter':
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      case 'year':
        startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }

    const [practiceLogs, poseProgress, streak, goals] = await Promise.all([
      prisma.studentPracticeLog.findMany({
        where: {
          userId,
          practiceDate: { gte: startDate },
        },
        orderBy: { practiceDate: 'desc' },
      }),
      prisma.poseProgress.findMany({
        where: { userId },
        include: {
          pose: {
            select: {
              id: true,
              name: true,
              difficulty: true,
            },
          },
        },
      }),
      prisma.practiceStreak.findFirst({
        where: { userId },
      }),
      prisma.studentGoal.findMany({
        where: {
          userId,
          status: 'active',
        },
      }),
    ]);

    // Calculate stats
    const totalPracticeTime = practiceLogs.reduce((sum, log) => sum + log.duration, 0);
    const averageSessionDuration = practiceLogs.length > 0 ? totalPracticeTime / practiceLogs.length : 0;
    
    const practiceByType = practiceLogs.reduce((acc, log) => {
      acc[log.practiceType] = (acc[log.practiceType] || 0) + 1;
      return acc;
    }, {});

    const masteredPoses = poseProgress.filter(p => p.mastered).length;
    const inProgressPoses = poseProgress.filter(p => !p.mastered && p.practiceCount > 0).length;

    const goalProgress = goals.reduce((acc, goal) => {
      acc.total++;
      if (goal.status === 'completed') acc.completed++;
      acc.averageProgress += goal.currentProgress;
      return acc;
    }, { total: 0, completed: 0, averageProgress: 0 });

    goalProgress.averageProgress = goalProgress.total > 0 ? goalProgress.averageProgress / goalProgress.total : 0;

    return {
      timeframe,
      summary: {
        totalSessions: practiceLogs.length,
        totalPracticeTime,
        averageSessionDuration,
        masteredPoses,
        inProgressPoses,
        currentStreak: streak?.currentStreak || 0,
        longestStreak: streak?.longestStreak || 0,
        goals: goalProgress,
      },
      practiceDistribution: practiceByType,
      recentSessions: practiceLogs.slice(0, 10),
      poseProgress: {
        mastered: poseProgress.filter(p => p.mastered),
        inProgress: poseProgress.filter(p => !p.mastered && p.practiceCount > 0).sort((a, b) => b.comfortLevel - a.comfortLevel),
      },
      activeGoals: goals,
    };
  }

  async getPoseProgress(userId: string, poseId: string) {
    const progress = await prisma.poseProgress.findFirst({
      where: {
        userId,
        poseId,
      },
      include: {
        pose: true,
      },
    });

    if (!progress) {
      return {
        poseId,
        userId,
        practiceCount: 0,
        totalDuration: 0,
        comfortLevel: 0,
        mastered: false,
        practiceHistory: [],
      };
    }

    // Get practice history for this pose
    const practiceHistory = await prisma.studentPracticeLog.findMany({
      where: {
        userId,
        posesPracticed: { has: poseId },
      },
      select: {
        id: true,
        practiceDate: true,
        duration: true,
        classId: true,
        sequenceId: true,
      },
      orderBy: { practiceDate: 'desc' },
      take: 20,
    });

    return {
      ...progress,
      practiceHistory,
    };
  }

  async getPracticeCalendar(userId: string, year: number, month: number) {
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0);

    const practiceLogs = await prisma.studentPracticeLog.findMany({
      where: {
        userId,
        practiceDate: {
          gte: startDate,
          lte: endDate,
        },
      },
      select: {
        practiceDate: true,
        duration: true,
        practiceType: true,
      },
    });

    // Group by day
    const calendar = {};
    practiceLogs.forEach(log => {
      const date = log.practiceDate.toISOString().split('T')[0];
      if (!calendar[date]) {
        calendar[date] = {
          date,
          totalDuration: 0,
          sessions: [],
        };
      }
      calendar[date].totalDuration += log.duration;
      calendar[date].sessions.push({
        duration: log.duration,
        type: log.practiceType,
      });
    });

    return {
      year,
      month,
      calendar,
      totalPracticeDays: Object.keys(calendar).length,
      totalPracticeTime: Object.values(calendar).reduce((sum: number, day: any) => sum + day.totalDuration, 0),
    };
  }

  async getAchievements(userId: string) {
    const achievements = [];

    // Check streak achievements
    const streak = await prisma.practiceStreak.findFirst({
      where: { userId },
    });

    if (streak) {
      if (streak.currentStreak >= 7) {
        achievements.push({
          id: '7-day-streak',
          name: 'Weekly Warrior',
          description: 'Practice for 7 consecutive days',
          achieved: true,
          achievedDate: streak.lastPracticeDate,
          icon: '🔥',
        });
      }

      if (streak.currentStreak >= 30) {
        achievements.push({
          id: '30-day-streak',
          name: 'Monthly Master',
          description: 'Practice for 30 consecutive days',
          achieved: true,
          achievedDate: streak.lastPracticeDate,
          icon: '🌟',
        });
      }
    }

    // Check pose mastery achievements
    const masteredPoses = await prisma.poseProgress.count({
      where: {
        userId,
        mastered: true,
      },
    });

    if (masteredPoses >= 10) {
      achievements.push({
        id: '10-poses-mastered',
        name: 'Pose Prodigy',
        description: 'Master 10 different yoga poses',
        achieved: true,
        icon: '🧘',
      });
    }

    if (masteredPoses >= 50) {
      achievements.push({
        id: '50-poses-mastered',
        name: 'Yoga Guru',
        description: 'Master 50 different yoga poses',
        achieved: true,
        icon: '🎯',
      });
    }

    // Check practice time achievements
    const totalPracticeTime = await prisma.studentPracticeLog.aggregate({
      where: { userId },
      _sum: {
        duration: true,
      },
    });

    const totalHours = (totalPracticeTime._sum.duration || 0) / 60;

    if (totalHours >= 100) {
      achievements.push({
        id: '100-hours',
        name: 'Century Club',
        description: 'Practice for 100 hours',
        achieved: true,
        icon: '⏱️',
      });
    }

    return achievements;
  }

  async getRecommendations(userId: string) {
    const recommendations = [];

    // Get user's pose progress
    const poseProgress = await prisma.poseProgress.findMany({
      where: { userId },
      include: {
        pose: true,
      },
    });

    // Recommend poses to improve
    const posesToImprove = poseProgress
      .filter(p => p.comfortLevel < 3 && p.practiceCount > 0)
      .sort((a, b) => a.comfortLevel - b.comfortLevel)
      .slice(0, 3);

    if (posesToImprove.length > 0) {
      recommendations.push({
        type: 'pose_improvement',
        title: 'Poses to Improve',
        description: 'Focus on these poses to build confidence',
        poses: posesToImprove.map(p => ({
          id: p.poseId,
          name: p.pose.name,
          currentLevel: p.comfortLevel,
          targetLevel: 4,
          practiceCount: p.practiceCount,
        })),
        action: 'Practice these poses in your next session',
      });
    }

    // Check for streak maintenance
    const streak = await prisma.practiceStreak.findFirst({
      where: { userId },
    });

    if (streak && streak.currentStreak > 0) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      if (streak.lastPracticeDate < today) {
        recommendations.push({
          type: 'streak_maintenance',
          title: 'Maintain Your Streak!',
          description: `You have a ${streak.currentStreak} day streak. Practice today to keep it going!`,
          currentStreak: streak.currentStreak,
          action: 'Schedule a practice session today',
        });
      }
    }

    // Recommend based on practice patterns
    const recentPractice = await prisma.studentPracticeLog.findMany({
      where: {
        userId,
        practiceDate: {
          gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        },
      },
    });

    const practiceByType = recentPractice.reduce((acc, log) => {
      acc[log.practiceType] = (acc[log.practiceType] || 0) + 1;
      return acc;
    }, {});

    // If user mostly does one type, recommend other types
    if (practiceByType.yoga && !practiceByType.meditation) {
      recommendations.push({
        type: 'practice_variety',
        title: 'Try Meditation',
        description: 'Complement your yoga practice with meditation for better mindfulness',
        currentPattern: 'Yoga-focused',
        suggestedPattern: 'Add meditation',
        action: 'Join a meditation class this week',
      });
    }

    return recommendations;
  }
}