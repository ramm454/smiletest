import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

@Injectable()
export class GdprTasks {
  // Run daily at 2 AM
  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async cleanupExpiredData() {
    console.log('[GDPR] Running data cleanup task');
    
    // 1. Delete expired sessions
    await prisma.session.deleteMany({
      where: {
        expiresAt: { lt: new Date() }
      }
    });
    
    // 2. Anonymize inactive users (after 2 years)
    const twoYearsAgo = new Date();
    twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);
    
    const inactiveUsers = await prisma.user.findMany({
      where: {
        lastLoginAt: { lt: twoYearsAgo },
        status: 'INACTIVE',
        pseudonymized: false
      }
    });
    
    for (const user of inactiveUsers) {
      await this.anonymizeUser(user.id);
    }
    
    // 3. Delete old exports (30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    // In production, delete actual export files
    console.log(`[GDPR] Would delete exports older than ${thirtyDaysAgo}`);
    
    // 4. Process pending deletions
    await this.processScheduledDeletions();
  }
  
  // Check DSAR deadlines every hour
  @Cron(CronExpression.EVERY_HOUR)
  async checkDsarDeadlines() {
    const dueRequests = await prisma.dataSubjectRequest.findMany({
      where: {
        status: { in: ['PENDING', 'VERIFICATION_REQUIRED', 'IN_PROGRESS'] },
        dueDate: { lt: new Date(Date.now() + 24 * 60 * 60 * 1000) } // Due in next 24 hours
      },
      include: { user: true }
    });
    
    for (const request of dueRequests) {
      // Send reminder to processing team
      await this.sendDeadlineReminder(request);
      
      // Escalate if overdue
      if (request.dueDate < new Date()) {
        await this.escalateOverdueRequest(request);
      }
    }
  }
  
  // Weekly compliance check
  @Cron(CronExpression.EVERY_WEEK)
  async weeklyComplianceCheck() {
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    
    const report = await this.generateWeeklyComplianceReport(weekAgo, new Date());
    
    // Send to DPO
    await this.sendReportToDpo(report);
  }
}