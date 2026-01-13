import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { EditRecordingDto, GenerateThumbnailDto } from '../dto/recording-edit.dto';
import * as ffmpeg from 'fluent-ffmpeg';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

@Injectable()
export class RecordingManagementService {
  async editRecording(recordingId: string, editDto: EditRecordingDto) {
    const recording = await prisma.recording.findUnique({
      where: { id: recordingId },
    });

    if (!recording) {
      throw new NotFoundException('Recording not found');
    }

    // Update metadata
    const updatedRecording = await prisma.recording.update({
      where: { id: recordingId },
      data: {
        ...(editDto.title && { title: editDto.title }),
        ...(editDto.description && { description: editDto.description }),
      },
    });

    // Process editing if trim points provided
    if (editDto.startTrim || editDto.endTrim) {
      await this.processVideoEditing(recording, editDto);
    }

    // Add watermark if requested
    if (editDto.addWatermark) {
      await this.addWatermark(recording, editDto.watermarkText);
    }

    // Add chapters if provided
    if (editDto.chapters) {
      await this.addChapters(recordingId, editDto.chapters);
    }

    return updatedRecording;
  }

  async generateThumbnail(recordingId: string, generateDto: GenerateThumbnailDto) {
    const recording = await prisma.recording.findUnique({
      where: { id: recordingId },
    });

    if (!recording) {
      throw new NotFoundException('Recording not found');
    }

    const thumbnailPath = await this.extractFrame(
      recording.fileUrl,
      generateDto.timestamp
    );

    // Update recording with thumbnail
    await prisma.recording.update({
      where: { id: recordingId },
      data: {
        thumbnailUrl: thumbnailPath,
      },
    });

    return { thumbnailUrl: thumbnailPath };
  }

  async getRecordingAnalytics(recordingId: string) {
    const recording = await prisma.recording.findUnique({
      where: { id: recordingId },
      include: {
        session: true,
      },
    });

    if (!recording) {
      throw new NotFoundException('Recording not found');
    }

    // Get viewing statistics
    const viewingStats = await prisma.$queryRaw`
      SELECT 
        COUNT(DISTINCT viewer_id) as unique_viewers,
        AVG(watch_time) as avg_watch_time,
        SUM(watch_time) as total_watch_time,
        MAX(watch_time) as max_watch_time
      FROM recording_viewership
      WHERE recording_id = ${recordingId}
    `;

    // Get engagement metrics
    const engagement = await this.calculateEngagementMetrics(recordingId);

    return {
      recording,
      viewingStats,
      engagement,
    };
  }

  async downloadRecording(recordingId: string, userId: string) {
    const recording = await prisma.recording.findUnique({
      where: { id: recordingId },
    });

    if (!recording) {
      throw new NotFoundException('Recording not found');
    }

    if (!recording.downloadEnabled) {
      throw new Error('Download not enabled for this recording');
    }

    // Check user permissions
    const participant = await prisma.liveSessionParticipant.findFirst({
      where: {
        sessionId: recording.sessionId,
        userId: userId,
      },
    });

    if (!participant && !recording.isPublic) {
      throw new Error('You do not have permission to download this recording');
    }

    // Log download
    await prisma.recording.update({
      where: { id: recordingId },
      data: {
        downloads: {
          increment: 1,
        },
      },
    });

    return {
      downloadUrl: recording.fileUrl,
      fileName: `recording-${recordingId}.${recording.format}`,
      fileSize: recording.fileSize,
    };
  }

  private async processVideoEditing(recording: any, editDto: EditRecordingDto) {
    const inputPath = recording.fileUrl;
    const outputPath = this.getEditedFilePath(recording.id);

    return new Promise((resolve, reject) => {
      let command = ffmpeg(inputPath);

      if (editDto.startTrim) {
        command = command.seekInput(editDto.startTrim);
      }

      if (editDto.endTrim) {
        const duration = editDto.endTrim - (editDto.startTrim || 0);
        command = command.duration(duration);
      }

      command
        .output(outputPath)
        .on('end', () => {
          // Update recording with new file URL
          resolve(outputPath);
        })
        .on('error', (err) => {
          reject(err);
        })
        .run();
    });
  }

  private async addWatermark(recording: any, watermarkText: string) {
    // Implement watermarking logic using ffmpeg
    console.log(`Adding watermark to recording ${recording.id}: ${watermarkText}`);
  }

  private async addChapters(recordingId: string, chapters: any[]) {
    await prisma.recording.update({
      where: { id: recordingId },
      data: {
        chapters: chapters,
      },
    });
  }

  private async extractFrame(videoPath: string, timestamp: number): Promise<string> {
    const outputPath = path.join(
      process.cwd(),
      'thumbnails',
      `thumbnail-${Date.now()}.jpg`
    );

    return new Promise((resolve, reject) => {
      ffmpeg(videoPath)
        .screenshots({
          timestamps: [timestamp],
          filename: path.basename(outputPath),
          folder: path.dirname(outputPath),
        })
        .on('end', () => resolve(outputPath))
        .on('error', reject);
    });
  }

  private getEditedFilePath(recordingId: string): string {
    return path.join(
      process.cwd(),
      'edited-recordings',
      `edited-${recordingId}-${Date.now()}.mp4`
    );
  }

  private async calculateEngagementMetrics(recordingId: string) {
    // Calculate engagement based on viewership data
    const metrics = await prisma.$queryRaw`
      SELECT 
        retention_rate,
        completion_rate,
        average_engagement_score
      FROM recording_engagement
      WHERE recording_id = ${recordingId}
    `;

    return metrics[0] || {};
  }
}