import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import * as ical from 'ical-generator';
import * as googleapis from 'googleapis';
import * as moment from 'moment';

@Injectable()
export class CalendarIntegrationService {
  private prisma = new PrismaClient();
  private calendar = googleapis.calendar('v3');

  async generateICalForBooking(bookingId: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        yogaClass: {
          include: {
            instructor: {
              select: {
                firstName: true,
                lastName: true,
              },
            },
          },
        },
        liveSession: {
          include: {
            instructor: {
              select: {
                firstName: true,
                lastName: true,
              },
            },
          },
        },
        user: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });

    if (!booking) {
      throw new BadRequestException('Booking not found');
    }

    const calendar = ical({
      name: 'Yoga Spa Booking',
      timezone: booking.timezone || 'UTC',
    });

    let eventTitle = 'Booking';
    let eventDescription = `Booking ID: ${booking.id}\n`;

    if (booking.yogaClass) {
      eventTitle = `${booking.yogaClass.title} - Yoga Class`;
      eventDescription += `Instructor: ${booking.yogaClass.instructor?.firstName} ${booking.yogaClass.instructor?.lastName}\n`;
      eventDescription += `Type: ${booking.yogaClass.type}\n`;
      eventDescription += `Difficulty: ${booking.yogaClass.difficulty}\n`;
    } else if (booking.liveSession) {
      eventTitle = `${booking.liveSession.title} - Live Session`;
      eventDescription += `Instructor: ${booking.liveSession.instructor?.firstName} ${booking.liveSession.instructor?.lastName}\n`;
    }

    if (booking.notes) {
      eventDescription += `Notes: ${booking.notes}\n`;
    }

    if (booking.specialRequests) {
      eventDescription += `Special Requests: ${booking.specialRequests}\n`;
    }

    calendar.createEvent({
      id: booking.id,
      start: booking.startTime,
      end: booking.endTime,
      summary: eventTitle,
      description: eventDescription,
      location: booking.yogaClass?.location || booking.liveSession?.streamUrl || '',
      url: `${process.env.FRONTEND_URL}/bookings/${booking.id}`,
      organizer: {
        name: 'Yoga Spa',
        email: 'bookings@yogaspa.com',
      },
      attendees: [
        {
          name: `${booking.user?.firstName} ${booking.user?.lastName}`,
          email: booking.user?.email,
          rsvp: true,
          partstat: 'ACCEPTED',
          role: 'REQ-PARTICIPANT',
        },
      ],
    });

    return calendar.toString();
  }

  async syncToGoogleCalendar(bookingId: string, accessToken: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        yogaClass: true,
        liveSession: true,
        user: true,
      },
    });

    if (!booking) {
      throw new BadRequestException('Booking not found');
    }

    const oauth2Client = new googleapis.auth.OAuth2();
    oauth2Client.setCredentials({ access_token: accessToken });

    const event = {
      summary: this.getEventTitle(booking),
      description: this.getEventDescription(booking),
      start: {
        dateTime: booking.startTime.toISOString(),
        timeZone: booking.timezone || 'UTC',
      },
      end: {
        dateTime: booking.endTime.toISOString(),
        timeZone: booking.timezone || 'UTC',
      },
      location: this.getEventLocation(booking),
      attendees: [
        {
          email: booking.user?.email,
          displayName: `${booking.user?.firstName} ${booking.user?.lastName}`,
          responseStatus: 'accepted',
        },
      ],
      reminders: {
        useDefault: false,
        overrides: [
          { method: 'email', minutes: 24 * 60 }, // 24 hours before
          { method: 'popup', minutes: 60 }, // 1 hour before
        ],
      },
    };

    try {
      const response = await this.calendar.events.insert({
        auth: oauth2Client,
        calendarId: 'primary',
        resource: event,
        sendUpdates: 'all',
      });

      // Save Google Calendar event ID
      await this.prisma.calendarEvent.upsert({
        where: { bookingId },
        update: {
          googleEventId: response.data.id,
          updatedAt: new Date(),
        },
        create: {
          userId: booking.userId,
          bookingId: booking.id,
          title: event.summary,
          description: event.description,
          startTime: booking.startTime,
          endTime: booking.endTime,
          timezone: booking.timezone || 'UTC',
          googleEventId: response.data.id,
          status: 'confirmed',
        },
      });

      return {
        success: true,
        eventId: response.data.id,
        htmlLink: response.data.htmlLink,
      };
    } catch (error) {
      console.error('Google Calendar sync error:', error);
      throw new BadRequestException('Failed to sync with Google Calendar');
    }
  }

  async syncToOutlookCalendar(bookingId: string, accessToken: string) {
    // Similar implementation for Outlook Calendar
    // This would use Microsoft Graph API
    console.log('Syncing to Outlook Calendar:', bookingId);
    
    // Implementation would go here
    return { success: true, message: 'Outlook sync not implemented' };
  }

  async syncToAppleCalendar(bookingId: string) {
    // Generate iCal file for Apple Calendar
    const icalContent = await this.generateICalForBooking(bookingId);
    
    return {
      success: true,
      icalContent,
      downloadUrl: `${process.env.API_URL}/bookings/${bookingId}/calendar/ical`,
    };
  }

  async getCalendarEvents(userId: string, calendarType?: string) {
    const where: any = { userId };
    
    if (calendarType === 'google') {
      where.googleEventId = { not: null };
    } else if (calendarType === 'outlook') {
      where.outlookEventId = { not: null };
    } else if (calendarType === 'apple') {
      where.appleEventId = { not: null };
    }

    const events = await this.prisma.calendarEvent.findMany({
      where,
      include: {
        booking: {
          include: {
            yogaClass: true,
            liveSession: true,
          },
        },
      },
      orderBy: { startTime: 'asc' },
    });

    return events;
  }

  async removeFromCalendar(bookingId: string, calendarType: string) {
    const event = await this.prisma.calendarEvent.findUnique({
      where: { bookingId },
    });

    if (!event) {
      throw new BadRequestException('Calendar event not found');
    }

    switch (calendarType) {
      case 'google':
        if (event.googleEventId) {
          // Remove from Google Calendar
          // Implementation would go here
        }
        break;
      case 'outlook':
        if (event.outlookEventId) {
          // Remove from Outlook Calendar
          // Implementation would go here
        }
        break;
      case 'apple':
        // Apple Calendar events are local, just remove our reference
        break;
    }

    await this.prisma.calendarEvent.update({
      where: { bookingId },
      data: {
        [`${calendarType}EventId`]: null,
      },
    });

    return { success: true };
  }

  async getCalendarSyncStatus(bookingId: string) {
    const event = await this.prisma.calendarEvent.findUnique({
      where: { bookingId },
    });

    if (!event) {
      return {
        synced: false,
        calendars: {},
      };
    }

    return {
      synced: true,
      calendars: {
        google: !!event.googleEventId,
        outlook: !!event.outlookEventId,
        apple: !!event.appleEventId,
      },
      lastSynced: event.updatedAt,
    };
  }

  private getEventTitle(booking: any): string {
    if (booking.yogaClass) {
      return `${booking.yogaClass.title} - Yoga Class`;
    } else if (booking.liveSession) {
      return `${booking.liveSession.title} - Live Session`;
    }
    return 'Booking';
  }

  private getEventDescription(booking: any): string {
    let description = `Booking ID: ${booking.id}\n`;
    
    if (booking.yogaClass) {
      description += `Instructor: ${booking.yogaClass.instructor?.firstName} ${booking.yogaClass.instructor?.lastName}\n`;
      description += `Type: ${booking.yogaClass.type}\n`;
      description += `Difficulty: ${booking.yogaClass.difficulty}\n`;
    } else if (booking.liveSession) {
      description += `Instructor: ${booking.liveSession.instructor?.firstName} ${booking.liveSession.instructor?.lastName}\n`;
    }

    if (booking.notes) {
      description += `Notes: ${booking.notes}\n`;
    }

    if (booking.specialRequests) {
      description += `Special Requests: ${booking.specialRequests}\n`;
    }

    description += `\nView booking: ${process.env.FRONTEND_URL}/bookings/${booking.id}`;
    
    return description;
  }

  private getEventLocation(booking: any): string {
    if (booking.yogaClass?.location) {
      return booking.yogaClass.location;
    } else if (booking.liveSession?.streamUrl) {
      return 'Online - ' + booking.liveSession.streamUrl;
    }
    return '';
  }
}