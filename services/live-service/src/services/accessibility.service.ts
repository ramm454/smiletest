import { Injectable } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import * as srt from 'subtitle';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

@Injectable()
export class AccessibilityService {
  async generateClosedCaptions(sessionId: string, language: string = 'en') {
    const session = await prisma.liveSession.findUnique({
      where: { id: sessionId },
      include: {
        recordings: {
          where: {
            status: 'COMPLETED',
          },
          take: 1,
        },
      },
    });

    if (!session) {
      throw new Error('Session not found');
    }

    if (session.recordings.length === 0) {
      throw new Error('No recording available');
    }

    const recording = session.recordings[0];

    // Check if captions already exist
    const existingCaptions = await prisma.closedCaption.findFirst({
      where: {
        sessionId,
        language,
        status: 'COMPLETED',
      },
    });

    if (existingCaptions) {
      return existingCaptions;
    }

    // Create caption record
    const caption = await prisma.closedCaption.create({
      data: {
        sessionId,
        recordingId: recording.id,
        language,
        status: 'PROCESSING',
        provider: 'auto',
      },
    });

    // Start async caption generation
    this.processCaptionGeneration(caption.id, recording.fileUrl, language);

    return caption;
  }

  async processCaptionGeneration(captionId: string, audioUrl: string, language: string) {
    try {
      // In production, integrate with speech-to-text service
      // For demo, generate mock captions
      await new Promise(resolve => setTimeout(resolve, 3000));

      const mockCaptions = this.generateMockCaptions();

      // Save captions
      await prisma.closedCaption.update({
        where: { id: captionId },
        data: {
          captionText: mockCaptions.text,
          captionSegments: mockCaptions.segments,
          status: 'COMPLETED',
          processedAt: new Date(),
        },
      });

      // Generate caption files
      await this.generateCaptionFiles(captionId, mockCaptions);

    } catch (error) {
      console.error('Caption generation failed:', error);
      
      await prisma.closedCaption.update({
        where: { id: captionId },
        data: {
          status: 'FAILED',
          errorMessage: error.message,
        },
      });
    }
  }

  async getCaptions(sessionId: string, format: 'srt' | 'vtt' | 'json' = 'json') {
    const captions = await prisma.closedCaption.findFirst({
      where: {
        sessionId,
        status: 'COMPLETED',
      },
    });

    if (!captions) {
      throw new Error('Captions not available');
    }

    switch (format) {
      case 'srt':
        return this.convertToSRT(captions.captionSegments as any[]);
      case 'vtt':
        return this.convertToVTT(captions.captionSegments as any[]);
      case 'json':
        return captions;
    }
  }

  async enableScreenReaderSupport(sessionId: string, userId: string) {
    // Save user preference
    await prisma.userAccessibilityPreference.upsert({
      where: {
        userId_sessionId: {
          userId,
          sessionId,
        },
      },
      update: {
        screenReaderEnabled: true,
      },
      create: {
        userId,
        sessionId,
        screenReaderEnabled: true,
      },
    });

    // Generate screen reader optimized content
    const optimizedContent = await this.generateScreenReaderContent(sessionId);

    return {
      enabled: true,
      optimizedContent,
      shortcuts: this.getScreenReaderShortcuts(),
    };
  }

  async setKeyboardNavigation(sessionId: string, userId: string, config: any) {
    await prisma.userAccessibilityPreference.upsert({
      where: {
        userId_sessionId: {
          userId,
          sessionId,
        },
      },
      update: {
        keyboardNavigation: config.enabled,
        navigationConfig: config,
      },
      create: {
        userId,
        sessionId,
        keyboardNavigation: config.enabled,
        navigationConfig: config,
      },
    });

    return {
      enabled: config.enabled,
      shortcuts: this.getKeyboardShortcuts(config),
    };
  }

  async getAccessibilityReport(sessionId: string) {
    const session = await prisma.liveSession.findUnique({
      where: { id: sessionId },
    });

    if (!session) {
      throw new Error('Session not found');
    }

    const accessibility = {
      captionsAvailable: false,
      screenReaderSupport: false,
      keyboardNavigation: false,
      highContrastMode: false,
      fontSizeAdjustment: false,
    };

    // Check captions
    const captions = await prisma.closedCaption.findFirst({
      where: { sessionId, status: 'COMPLETED' },
    });
    accessibility.captionsAvailable = !!captions;

    // Check other features based on session configuration
    // This would be determined by the session setup

    return accessibility;
  }

  async recordAccessibilityUsage(sessionId: string, userId: string, feature: string, data: any) {
    await prisma.accessibilityUsageLog.create({
      data: {
        sessionId,
        userId,
        feature,
        action: data.action,
        metadata: data.metadata,
      },
    });
  }

  private generateMockCaptions() {
    const segments = [];
    let start = 0;
    
    for (let i = 0; i < 10; i++) {
      const duration = Math.random() * 5 + 2; // 2-7 seconds
      segments.push({
        id: i + 1,
        start,
        end: start + duration,
        text: `This is caption segment ${i + 1} for the yoga session.`,
      });
      start += duration;
    }

    const text = segments.map(s => s.text).join(' ');

    return { segments, text };
  }

  private async generateCaptionFiles(captionId: string, captions: any) {
    const captionDir = path.join(process.cwd(), 'captions', captionId);
    
    if (!fs.existsSync(captionDir)) {
      fs.mkdirSync(captionDir, { recursive: true });
    }

    // Generate SRT file
    const srtContent = this.convertToSRT(captions.segments);
    fs.writeFileSync(path.join(captionDir, 'captions.srt'), srtContent);

    // Generate VTT file
    const vttContent = this.convertToVTT(captions.segments);
    fs.writeFileSync(path.join(captionDir, 'captions.vtt'), vttContent);

    // Generate JSON file
    fs.writeFileSync(
      path.join(captionDir, 'captions.json'),
      JSON.stringify(captions, null, 2)
    );

    // Update caption record with file paths
    await prisma.closedCaption.update({
      where: { id: captionId },
      data: {
        filePaths: {
          srt: `/captions/${captionId}/captions.srt`,
          vtt: `/captions/${captionId}/captions.vtt`,
          json: `/captions/${captionId}/captions.json`,
        },
      },
    });
  }

  private convertToSRT(segments: any[]): string {
    let srt = '';
    
    segments.forEach((segment, index) => {
      srt += `${index + 1}\n`;
      srt += `${this.formatTimeSRT(segment.start)} --> ${this.formatTimeSRT(segment.end)}\n`;
      srt += `${segment.text}\n\n`;
    });
    
    return srt;
  }

  private convertToVTT(segments: any[]): string {
    let vtt = 'WEBVTT\n\n';
    
    segments.forEach((segment, index) => {
      vtt += `${this.formatTimeVTT(segment.start)} --> ${this.formatTimeVTT(segment.end)}\n`;
      vtt += `${segment.text}\n\n`;
    });
    
    return vtt;
  }

  private formatTimeSRT(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    const millis = Math.floor((seconds % 1) * 1000);
    
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')},${millis.toString().padStart(3, '0')}`;
  }

  private formatTimeVTT(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    const millis = Math.floor((seconds % 1) * 1000);
    
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${millis.toString().padStart(3, '0')}`;
  }

  private async generateScreenReaderContent(sessionId: string) {
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
      return null;
    }

    return {
      title: session.title,
      description: session.description,
      instructor: `${session.instructor.firstName} ${session.instructor.lastName}`,
      startTime: session.startTime,
      duration: session.duration,
      agenda: this.extractAgenda(session.agenda),
      controls: this.getScreenReaderControls(),
      landmarks: this.getSessionLandmarks(),
    };
  }

  private extractAgenda(agenda: any): string[] {
    if (!agenda) return [];
    
    try {
      if (typeof agenda === 'string') {
        return agenda.split('\n').filter(line => line.trim());
      }
      
      if (Array.isArray(agenda)) {
        return agenda;
      }
      
      return [];
    } catch {
      return [];
    }
  }

  private getScreenReaderControls() {
    return {
      playPause: 'Space or K',
      volumeUp: 'Up Arrow',
      volumeDown: 'Down Arrow',
      mute: 'M',
      fullscreen: 'F',
      captions: 'C',
      seekForward: 'Right Arrow',
      seekBackward: 'Left Arrow',
      nextChapter: 'Shift + N',
      previousChapter: 'Shift + P',
    };
  }

  private getScreenReaderShortcuts() {
    return {
      navigateToVideo: 'V',
      navigateToChat: 'T',
      navigateToParticipants: 'P',
      navigateToControls: 'C',
      readCurrentTime: 'R',
      toggleCaptions: 'Shift + C',
      increasePlaybackRate: 'Shift + >',
      decreasePlaybackRate: 'Shift + <',
    };
  }

  private getKeyboardShortcuts(config: any) {
    const baseShortcuts = {
      'Space': 'Play/Pause',
      'K': 'Play/Pause',
      'F': 'Fullscreen',
      'M': 'Mute',
      'ArrowUp': 'Volume Up',
      'ArrowDown': 'Volume Down',
      'ArrowLeft': 'Seek Backward',
      'ArrowRight': 'Seek Forward',
      'C': 'Toggle Captions',
    };

    if (config.customShortcuts) {
      return { ...baseShortcuts, ...config.customShortcuts };
    }

    return baseShortcuts;
  }

  private getSessionLandmarks() {
    return {
      main: 'Main video content',
      navigation: 'Session navigation controls',
      chat: 'Live chat area',
      participants: 'Participants list',
      controls: 'Media controls',
      captions: 'Closed captions display',
    };
  }
}