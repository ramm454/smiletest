// src/modules/training/model-updater.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { EventEmitter2 } from '@nestjs/event-emitter';
import * as fs from 'fs/promises';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

@Injectable()
export class ModelUpdaterService {
  private readonly logger = new Logger(ModelUpdaterService.name);
  private prisma = new PrismaClient();
  private isTraining = false;
  private trainingQueue: Array<{
    modelId: string;
    data: any[];
    priority: number;
  }> = [];
  
  constructor(private eventEmitter: EventEmitter2) {
    this.startTrainingProcessor();
  }
  
  async updateModelWithFeedback(
    modelId: string,
    feedback: {
      originalText: string;
      translatedText: string;
      correctedText?: string;
      rating: number;
      confidence: number;
      context?: any;
    }
  ) {
    // Store feedback for later training
    await this.prisma.modelFeedback.create({
      data: {
        modelId,
        originalText: feedback.originalText,
        translatedText: feedback.translatedText,
        correctedText: feedback.correctedText,
        rating: feedback.rating,
        confidence: feedback.confidence,
        context: feedback.context,
        timestamp: new Date()
      }
    });
    
    // If confidence is low or rating is poor, trigger immediate update
    if (feedback.confidence < 0.7 || feedback.rating < 3) {
      await this.scheduleModelUpdate(modelId, 'high');
    }
    
    this.logger.log(`Received feedback for model ${modelId}, rating: ${feedback.rating}`);
  }
  
  async scheduleModelUpdate(modelId: string, priority: 'low' | 'medium' | 'high' = 'medium') {
    const priorityMap = { low: 1, medium: 2, high: 3 };
    
    // Check if already in queue
    const existingIndex = this.trainingQueue.findIndex(item => item.modelId === modelId);
    if (existingIndex !== -1) {
      // Update priority if higher
      if (priorityMap[priority] > this.trainingQueue[existingIndex].priority) {
        this.trainingQueue[existingIndex].priority = priorityMap[priority];
        this.logger.log(`Updated priority for model ${modelId} to ${priority}`);
      }
      return;
    }
    
    // Collect recent feedback for training
    const recentFeedback = await this.prisma.modelFeedback.findMany({
      where: {
        modelId,
        timestamp: {
          gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // Last 7 days
        }
      },
      take: 1000
    });
    
    if (recentFeedback.length === 0) {
      this.logger.log(`No recent feedback for model ${modelId}, skipping update`);
      return;
    }
    
    // Add to queue
    this.trainingQueue.push({
      modelId,
      data: recentFeedback,
      priority: priorityMap[priority]
    });
    
    // Sort queue by priority
    this.trainingQueue.sort((a, b) => b.priority - a.priority);
    
    this.logger.log(`Scheduled update for model ${modelId} with ${recentFeedback.length} feedback items`);
  }
  
  private async startTrainingProcessor() {
    setInterval(async () => {
      if (this.isTraining || this.trainingQueue.length === 0) {
        return;
      }
      
      this.isTraining = true;
      
      try {
        const job = this.trainingQueue.shift();
        if (!job) return;
        
        await this.trainModel(job.modelId, job.data);
      } catch (error) {
        this.logger.error('Training processor error:', error);
      } finally {
        this.isTraining = false;
      }
    }, 60000); // Check every minute
  }
  
  private async trainModel(modelId: string, feedbackData: any[]) {
    this.logger.log(`Starting training for model ${modelId} with ${feedbackData.length} samples`);
    
    // Update training job status
    const trainingJob = await this.prisma.trainingJob.create({
      data: {
        modelId,
        status: 'training',
        progress: 0,
        datasetSize: feedbackData.length,
        startedAt: new Date()
      }
    });
    
    try {
      // Prepare training data
      const trainingData = this.prepareTrainingData(feedbackData);
      
      // Save training data to file
      const trainingDir = path.join(process.cwd(), 'training-data', modelId);
      await fs.mkdir(trainingDir, { recursive: true });
      
      const dataPath = path.join(trainingDir, `train_${Date.now()}.json`);
      await fs.writeFile(dataPath, JSON.stringify(trainingData, null, 2));
      
      // Update progress
      await this.prisma.trainingJob.update({
        where: { id: trainingJob.id },
        data: { progress: 0.3 }
      });
      
      // Execute training script
      const model = await this.prisma.aIModel.findUnique({
        where: { id: modelId }
      });
      
      if (!model) {
        throw new Error(`Model ${modelId} not found`);
      }
      
      // Run training (this would call your Python training script)
      await this.executeTrainingScript(model, dataPath, trainingJob.id);
      
      // Update progress
      await this.prisma.trainingJob.update({
        where: { id: trainingJob.id },
        data: { progress: 1.0, status: 'completed', completedAt: new Date() }
      });
      
      // Update model version
      await this.prisma.aIModel.update({
        where: { id: modelId },
        data: {
          version: this.incrementVersion(model.version),
          lastTrained: new Date()
        }
      });
      
      // Emit event for model update
      this.eventEmitter.emit('model.updated', {
        modelId,
        version: this.incrementVersion(model.version),
        samples: feedbackData.length
      });
      
      this.logger.log(`Training completed for model ${modelId}`);
      
    } catch (error) {
      await this.prisma.trainingJob.update({
        where: { id: trainingJob.id },
        data: {
          status: 'failed',
          failedAt: new Date(),
          error: error.message
        }
      });
      
      this.logger.error(`Training failed for model ${modelId}:`, error);
    }
  }
  
  private prepareTrainingData(feedbackData: any[]): any[] {
    return feedbackData
      .filter(f => f.correctedText && f.originalText)
      .map(f => ({
        source: f.originalText,
        target: f.correctedText || f.translatedText,
        source_lang: f.context?.sourceLang || 'auto',
        target_lang: f.context?.targetLang || 'en',
        domain: f.context?.domain,
        formality: f.context?.formality
      }));
  }
  
  private async executeTrainingScript(model: any, dataPath: string, jobId: string) {
    // This would execute your Python training script
    // Example implementation:
    
    const scriptPath = path.join(process.cwd(), 'scripts', 'incremental_train.py');
    const modelPath = model.modelPath;
    const outputPath = path.join(path.dirname(modelPath), `updated_${Date.now()}.pt`);
    
    const command = `python3 ${scriptPath} \
      --model ${modelPath} \
      --data ${dataPath} \
      --output ${outputPath} \
      --epochs 3 \
      --learning-rate 0.0001`;
    
    try {
      const { stdout, stderr } = await execAsync(command, {
        cwd: process.cwd(),
        maxBuffer: 1024 * 1024 * 50 // 50MB buffer
      });
      
      // Update model path in database
      await this.prisma.aIModel.update({
        where: { id: model.id },
        data: { modelPath: outputPath }
      });
      
      // Clean up old model files (keep last 3 versions)
      await this.cleanupOldModels(model.id, modelPath);
      
      this.logger.log(`Training script output: ${stdout}`);
      
    } catch (error) {
      this.logger.error(`Training script failed: ${error.stderr || error.message}`);
      throw error;
    }
  }
  
  private async cleanupOldModels(modelId: string, currentPath: string) {
    const modelDir = path.dirname(currentPath);
    
    try {
      const files = await fs.readdir(modelDir);
      const modelFiles = files
        .filter(f => f.endsWith('.pt') && f.includes(modelId))
        .sort()
        .reverse();
      
      // Keep only the 3 most recent models
      const toDelete = modelFiles.slice(3);
      
      for (const file of toDelete) {
        await fs.unlink(path.join(modelDir, file));
        this.logger.log(`Deleted old model file: ${file}`);
      }
    } catch (error) {
      this.logger.error('Failed to cleanup old models:', error);
    }
  }
  
  private incrementVersion(version: string): string {
    const parts = version.split('.').map(Number);
    parts[parts.length - 1] += 1; // Increment patch version
    
    // Handle carry-over
    for (let i = parts.length - 1; i > 0; i--) {
      if (parts[i] >= 10) {
        parts[i] = 0;
        parts[i - 1] += 1;
      }
    }
    
    return parts.join('.');
  }
  
  async getModelPerformance(modelId: string): Promise<any> {
    const model = await this.prisma.aIModel.findUnique({
      where: { id: modelId },
      include: {
        feedbacks: {
          take: 100,
          orderBy: { timestamp: 'desc' }
        },
        trainingJobs: {
          take: 10,
          orderBy: { startedAt: 'desc' }
        }
      }
    });
    
    if (!model) {
      throw new Error(`Model ${modelId} not found`);
    }
    
    // Calculate performance metrics
    const recentFeedback = model.feedbacks.slice(0, 100);
    const averageRating = recentFeedback.reduce((sum, f) => sum + f.rating, 0) / (recentFeedback.length || 1);
    const averageConfidence = recentFeedback.reduce((sum, f) => sum + (f.confidence || 0), 0) / (recentFeedback.length || 1);
    
    const improvement = await this.calculateImprovement(modelId);
    
    return {
      modelId,
      version: model.version,
      averageRating,
      averageConfidence,
      feedbackCount: model.feedbacks.length,
      recentTraining: model.trainingJobs.length > 0 ? model.trainingJobs[0] : null,
      improvement,
      recommendations: this.generateRecommendations(model)
    };
  }
  
  private async calculateImprovement(modelId: string): Promise<number> {
    const jobs = await this.prisma.trainingJob.findMany({
      where: { modelId, status: 'completed' },
      orderBy: { completedAt: 'desc' },
      take: 2
    });
    
    if (jobs.length < 2) return 0;
    
    // Compare metrics between last two training jobs
    const [recent, previous] = jobs;
    
    // This would compare actual metrics from training
    // For now, return a placeholder
    return 0.05; // 5% improvement
  }
  
  private generateRecommendations(model: any): string[] {
    const recommendations = [];
    
    if (model.feedbacks.length < 100) {
      recommendations.push('Need more training data. Collect more user feedback.');
    }
    
    if (model.lastTrained && Date.now() - model.lastTrained.getTime() > 30 * 24 * 60 * 60 * 1000) {
      recommendations.push('Model hasn\'t been trained in over 30 days. Schedule retraining.');
    }
    
    const lowConfidenceFeedbacks = model.feedbacks.filter((f: any) => f.confidence < 0.7);
    if (lowConfidenceFeedbacks.length > model.feedbacks.length * 0.3) {
      recommendations.push('High percentage of low-confidence translations. Consider domain-specific training.');
    }
    
    return recommendations;
  }
}