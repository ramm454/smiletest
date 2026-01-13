import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { LivePaymentClient } from './live-payment.client';

@Injectable()
export class LivePaymentService {
    private paymentClient: LivePaymentClient;

    constructor(private prisma: PrismaService) {
        this.paymentClient = new LivePaymentClient();
    }

    async purchaseSession(sessionId: string, userId: string): Promise<any> {
        // Get session details
        const session = await this.prisma.liveSession.findUnique({
            where: { id: sessionId },
            include: { instructor: true },
        });

        if (!session) {
            throw new Error('Session not found');
        }

        // Get user details
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
        });

        // Check if user already has access
        const existingAccess = await this.prisma.sessionAccess.findFirst({
            where: {
                userId,
                sessionId,
                status: 'active',
            },
        });

        if (existingAccess) {
            return {
                already_has_access: true,
                access_token: existingAccess.accessToken,
            };
        }

        // Check if session is free
        if (session.price === 0) {
            return this.grantFreeAccess(sessionId, userId);
        }

        // Initiate payment
        const payment = await this.paymentClient.purchaseSessionAccess({
            sessionId: session.id,
            amount: session.price,
            currency: session.currency,
            customerEmail: user.email,
            customerName: `${user.firstName} ${user.lastName}`,
            metadata: {
                session_title: session.title,
                instructor_name: session.instructor?.name,
                start_time: session.startTime,
                duration: session.duration,
            },
        });

        // Create pending access record
        await this.prisma.sessionAccess.create({
            data: {
                sessionId,
                userId,
                paymentId: payment.paymentId,
                status: 'pending_payment',
                accessToken: this.generateAccessToken(),
                expiresAt: this.calculateExpiry(session.endTime),
            },
        });

        return payment;
    }

    async handlePaymentWebhook(paymentId: string, status: string): Promise<void> {
        // Find session access by payment ID
        const access = await this.prisma.sessionAccess.findFirst({
            where: { paymentId },
            include: { session: true, user: true },
        });

        if (!access) {
            throw new Error('Session access not found for payment');
        }

        if (status === 'succeeded') {
            // Grant access
            await this.prisma.sessionAccess.update({
                where: { id: access.id },
                data: {
                    status: 'active',
                    activatedAt: new Date(),
                },
            });

            // Send access email
            await this.sendAccessEmail(access.user, access.session, access.accessToken);
        } else if (status === 'failed') {
            // Mark as failed
            await this.prisma.sessionAccess.update({
                where: { id: access.id },
                data: {
                    status: 'payment_failed',
                },
            });
        }
    }

    private async grantFreeAccess(sessionId: string, userId: string): Promise<any> {
        const accessToken = this.generateAccessToken();
        
        const access = await this.prisma.sessionAccess.create({
            data: {
                sessionId,
                userId,
                status: 'active',
                accessToken,
                expiresAt: this.calculateExpiry(new Date(Date.now() + 24 * 60 * 60 * 1000)), // 24 hours
                activatedAt: new Date(),
            },
        });

        // Get session and user for notification
        const session = await this.prisma.liveSession.findUnique({
            where: { id: sessionId },
        });

        const user = await this.prisma.user.findUnique({
            where: { id: userId },
        });

        // Send access email
        await this.sendAccessEmail(user, session, accessToken);

        return {
            free_access: true,
            access_token: accessToken,
            expires_at: access.expiresAt,
        };
    }

    private generateAccessToken(): string {
        return `live_${Math.random().toString(36).substring(2)}_${Date.now().toString(36)}`;
    }

    private calculateExpiry(sessionEndTime: Date): Date {
        // Access expires 1 hour after session ends
        return new Date(sessionEndTime.getTime() + 60 * 60 * 1000);
    }

    private async sendAccessEmail(user: any, session: any, accessToken: string): Promise<void> {
        // Implement email sending logic
        console.log(`Access email sent to ${user.email} for session ${session.title}`);
        console.log(`Access token: ${accessToken}`);
    }

    async validateAccess(sessionId: string, accessToken: string): Promise<boolean> {
        const access = await this.prisma.sessionAccess.findFirst({
            where: {
                sessionId,
                accessToken,
                status: 'active',
                expiresAt: {
                    gt: new Date(),
                },
            },
        });

        return !!access;
    }
}