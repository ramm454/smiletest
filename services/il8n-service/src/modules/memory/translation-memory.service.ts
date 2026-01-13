// src/modules/memory/translation-memory.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import * as crypto from 'crypto';
import * as natural from 'natural';
import * as similarity from 'string-similarity';

@Injectable()
export class TranslationMemoryService {
  private readonly logger = new Logger(TranslationMemoryService.name);
  private prisma = new PrismaClient();
  private tokenizer = new natural.WordTokenizer();
  private tfidf: natural.TfIdf;
  
  constructor() {
    this.tfidf = new natural.TfIdf();
    this.initializeTfidf();
  }
  
  private async initializeTfidf() {
    // Load existing translations into TF-IDF
    const translations = await this.prisma.translation.findMany({
      where: { aiGenerated: false } // Use human translations for better quality
    });
    
    translations.forEach(trans => {
      const values = trans.values as Record<string, string>;
      Object.values(values).forEach(text => {
        if (text) {
          this.tfidf.addDocument(text);
        }
      });
    });
  }
  
  async findSimilarTranslations(
    text: string,
    targetLang: string,
    threshold = 0.7,
    maxResults = 5
  ) {
    const similar = [];
    
    // Search in database using fuzzy matching
    const translations = await this.prisma.translation.findMany({
      where: {
        values: {
          path: [targetLang],
          not: null
        }
      },
      take: 1000 // Limit for performance
    });
    
    for (const translation of translations) {
      const targetText = (translation.values as Record<string, string>)[targetLang];
      if (!targetText) continue;
      
      // Calculate similarity using multiple methods
      const similarityScore = this.calculateSimilarity(text, targetText);
      
      if (similarityScore >= threshold) {
        similar.push({
          translation,
          similarity: similarityScore,
          confidence: this.calculateConfidence(text, targetText, similarityScore)
        });
      }
    }
    
    // Sort by similarity and confidence
    similar.sort((a, b) => {
      const scoreA = a.similarity * 0.7 + a.confidence * 0.3;
      const scoreB = b.similarity * 0.7 + b.confidence * 0.3;
      return scoreB - scoreA;
    });
    
    return similar.slice(0, maxResults);
  }
  
  async fuzzyTranslate(
    text: string,
    targetLang: string,
    context?: any,
    minConfidence = 0.8
  ): Promise<{ translation: string; confidence: number; source: string } | null> {
    
    // First, try exact match
    const exactMatch = await this.prisma.translation.findFirst({
      where: {
        values: {
          path: ['en'], // Assuming source is English
          equals: text
        }
      }
    });
    
    if (exactMatch) {
      const translation = (exactMatch.values as Record<string, string>)[targetLang];
      if (translation) {
        return {
          translation,
          confidence: 1.0,
          source: 'exact_match'
        };
      }
    }
    
    // Try similar translations
    const similar = await this.findSimilarTranslations(text, targetLang, 0.6);
    
    for (const item of similar) {
      if (item.confidence >= minConfidence) {
        const translation = (item.translation.values as Record<string, string>)[targetLang];
        
        // Adapt translation to context if needed
        const adapted = this.adaptToContext(translation, text, context);
        
        return {
          translation: adapted,
          confidence: item.confidence,
          source: 'fuzzy_match'
        };
      }
    }
    
    return null;
  }
  
  async learnFromCorrection(
    originalText: string,
    correctedTranslation: string,
    targetLang: string,
    context?: any
  ) {
    // Create or update translation memory entry
    const key = this.generateKey(originalText);
    
    await this.prisma.translationMemory.upsert({
      where: { key },
      update: {
        translations: {
          push: {
            text: correctedTranslation,
            language: targetLang,
            context,
            timestamp: new Date().toISOString(),
            source: 'human_correction'
          }
        },
        usageCount: { increment: 1 },
        lastUsed: new Date()
      },
      create: {
        key,
        originalText,
        translations: [{
          text: correctedTranslation,
          language: targetLang,
          context,
          timestamp: new Date().toISOString(),
          source: 'human_correction'
        }],
        usageCount: 1,
        lastUsed: new Date()
      }
    });
    
    // Update TF-IDF
    this.tfidf.addDocument(correctedTranslation);
    
    // Trigger model retraining if confidence was low
    this.logger.log(`Learned from correction: ${originalText} -> ${correctedTranslation}`);
  }
  
  async getTranslationMemoryStats() {
    const totalEntries = await this.prisma.translationMemory.count();
    const usageStats = await this.prisma.translationMemory.groupBy({
      by: ['source'],
      _count: true,
      _sum: {
        usageCount: true
      }
    });
    
    const hitRate = await this.calculateHitRate();
    
    return {
      totalEntries,
      usageStats,
      hitRate,
      averageConfidence: await this.getAverageConfidence()
    };
  }
  
  async cleanTranslationMemory(maxAgeDays = 365, minUsage = 1) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - maxAgeDays);
    
    const deleted = await this.prisma.translationMemory.deleteMany({
      where: {
        AND: [
          { lastUsed: { lt: cutoffDate } },
          { usageCount: { lt: minUsage } }
        ]
      }
    });
    
    this.logger.log(`Cleaned ${deleted.count} old translation memory entries`);
    return deleted.count;
  }
  
  private calculateSimilarity(text1: string, text2: string): number {
    // Use multiple similarity metrics
    const metrics = {
      levenshtein: 1 - (natural.LevenshteinDistance(text1, text2) / Math.max(text1.length, text2.length)),
      jaroWinkler: natural.JaroWinklerDistance(text1, text2),
      cosine: this.cosineSimilarity(text1, text2),
      ngram: this.ngramSimilarity(text1, text2, 2)
    };
    
    // Weighted average
    const weights = { levenshtein: 0.3, jaroWinkler: 0.2, cosine: 0.3, ngram: 0.2 };
    let total = 0;
    let weightSum = 0;
    
    for (const [metric, score] of Object.entries(metrics)) {
      total += score * weights[metric as keyof typeof weights];
      weightSum += weights[metric as keyof typeof weights];
    }
    
    return total / weightSum;
  }
  
  private cosineSimilarity(text1: string, text2: string): number {
    const tokens1 = this.tokenizer.tokenize(text1.toLowerCase());
    const tokens2 = this.tokenizer.tokenize(text2.toLowerCase());
    
    const allTokens = new Set([...tokens1, ...tokens2]);
    const vec1 = Array.from(allTokens).map(token => tokens1.filter(t => t === token).length);
    const vec2 = Array.from(allTokens).map(token => tokens2.filter(t => t === token).length);
    
    const dotProduct = vec1.reduce((sum, val, i) => sum + val * vec2[i], 0);
    const magnitude1 = Math.sqrt(vec1.reduce((sum, val) => sum + val * val, 0));
    const magnitude2 = Math.sqrt(vec2.reduce((sum, val) => sum + val * val, 0));
    
    if (magnitude1 === 0 || magnitude2 === 0) return 0;
    return dotProduct / (magnitude1 * magnitude2);
  }
  
  private ngramSimilarity(text1: string, text2: string, n: number): number {
    const ngrams1 = this.getNgrams(text1, n);
    const ngrams2 = this.getNgrams(text2, n);
    
    const intersection = new Set([...ngrams1].filter(x => ngrams2.has(x)));
    const union = new Set([...ngrams1, ...ngrams2]);
    
    return union.size > 0 ? intersection.size / union.size : 0;
  }
  
  private getNgrams(text: string, n: number): Set<string> {
    const ngrams = new Set<string>();
    const tokens = this.tokenizer.tokenize(text.toLowerCase());
    
    for (let i = 0; i <= tokens.length - n; i++) {
      ngrams.add(tokens.slice(i, i + n).join(' '));
    }
    
    return ngrams;
  }
  
  private calculateConfidence(text1: string, text2: string, similarity: number): number {
    // Additional confidence factors
    const lengthRatio = Math.min(text1.length, text2.length) / Math.max(text1.length, text2.length);
    const wordCountSimilarity = 1 - Math.abs(
      this.tokenizer.tokenize(text1).length - this.tokenizer.tokenize(text2).length
    ) / Math.max(this.tokenizer.tokenize(text1).length, 1);
    
    // TF-IDF relevance
    const tfidfScore = this.calculateTfidfRelevance(text1, text2);
    
    // Combined confidence
    return (
      similarity * 0.5 +
      lengthRatio * 0.2 +
      wordCountSimilarity * 0.2 +
      tfidfScore * 0.1
    );
  }
  
  private calculateTfidfRelevance(text1: string, text2: string): number {
    const tokens1 = this.tokenizer.tokenize(text1.toLowerCase());
    const tokens2 = this.tokenizer.tokenize(text2.toLowerCase());
    
    let score = 0;
    tokens1.forEach(token => {
      this.tfidf.tfidfs(token, (i, measure) => {
        if (tokens2.includes(token)) {
          score += measure;
        }
      });
    });
    
    return Math.min(score / (tokens1.length || 1), 1);
  }
  
  private adaptToContext(translation: string, originalText: string, context?: any): string {
    if (!context) return translation;
    
    // Adapt based on context (domain, tone, formality, etc.)
    let adapted = translation;
    
    // Example: Adapt formality
    if (context.formality === 'formal') {
      adapted = this.makeFormal(adapted);
    } else if (context.formality === 'informal') {
      adapted = this.makeInformal(adapted);
    }
    
    // Example: Adapt for domain
    if (context.domain === 'medical') {
      adapted = this.adaptForMedical(adapted);
    } else if (context.domain === 'technical') {
      adapted = this.adaptForTechnical(adapted);
    }
    
    return adapted;
  }
  
  private makeFormal(text: string): string {
    // Simple formalization rules
    return text.replace(/\b(can't|won't|don't)\b/gi, (match) => {
      const map: Record<string, string> = {
        "can't": "cannot",
        "won't": "will not",
        "don't": "do not"
      };
      return map[match.toLowerCase()] || match;
    });
  }
  
  private makeInformal(text: string): string {
    // Simple informalization rules
    return text.replace(/\b(cannot|will not|do not)\b/gi, (match) => {
      const map: Record<string, string> = {
        "cannot": "can't",
        "will not": "won't",
        "do not": "don't"
      };
      return map[match.toLowerCase()] || match;
    });
  }
  
  private adaptForMedical(text: string): string {
    // Add medical context
    return text; // Implement medical terminology adaptation
  }
  
  private adaptForTechnical(text: string): string {
    // Add technical context
    return text; // Implement technical terminology adaptation
  }
  
  private generateKey(text: string): string {
    return crypto.createHash('sha256').update(text.toLowerCase().trim()).digest('hex');
  }
  
  private async calculateHitRate(): Promise<number> {
    const lastWeek = new Date();
    lastWeek.setDate(lastWeek.getDate() - 7);
    
    const totalRequests = await this.prisma.translationRequest.count({
      where: { timestamp: { gte: lastWeek } }
    });
    
    const cacheHits = await this.prisma.translationRequest.count({
      where: {
        timestamp: { gte: lastWeek },
        cacheHit: true
      }
    });
    
    return totalRequests > 0 ? cacheHits / totalRequests : 0;
  }
  
  private async getAverageConfidence(): Promise<number> {
    const result = await this.prisma.translationRequest.aggregate({
      where: {
        confidence: { not: null }
      },
      _avg: {
        confidence: true
      }
    });
    
    return result._avg.confidence || 0;
  }
}