// src/utils/monitoring.ts
import { Counter, Histogram, Gauge, Registry } from 'prom-client';
import { Logger } from '@nestjs/common';
import * as os from 'os';

export class I18nMetrics {
  private static registry = new Registry();
  private static logger = new Logger('Metrics');
  
  // Translation metrics
  static translationRequests = new Counter({
    name: 'i18n_translation_requests_total',
    help: 'Total number of translation requests',
    labelNames: ['target_lang', 'source_lang', 'service', 'cache_status']
  });
  
  static translationDuration = new Histogram({
    name: 'i18n_translation_duration_seconds',
    help: 'Duration of translation requests in seconds',
    labelNames: ['target_lang', 'source_lang'],
    buckets: [0.1, 0.5, 1, 2, 5, 10]
  });
  
  static translationQuality = new Histogram({
    name: 'i18n_translation_quality_score',
    help: 'Quality score of translations (0-1)',
    labelNames: ['target_lang', 'source_lang', 'model_version'],
    buckets: [0.1, 0.3, 0.5, 0.7, 0.9, 1.0]
  });
  
  // Language detection metrics
  static detectionRequests = new Counter({
    name: 'i18n_detection_requests_total',
    help: 'Total number of language detection requests',
    labelNames: ['method', 'accuracy']
  });
  
  static detectionAccuracy = new Histogram({
    name: 'i18n_detection_accuracy',
    help: 'Accuracy of language detection',
    labelNames: ['method'],
    buckets: [0.5, 0.75, 0.9, 0.95, 0.99, 1.0]
  });
  
  // Cache metrics
  static cacheHits = new Counter({
    name: 'i18n_cache_hits_total',
    help: 'Total number of cache hits',
    labelNames: ['cache_layer', 'type']
  });
  
  static cacheMisses = new Counter({
    name: 'i18n_cache_misses_total',
    help: 'Total number of cache misses',
    labelNames: ['cache_layer', 'type']
  });
  
  static cacheSize = new Gauge({
    name: 'i18n_cache_size_bytes',
    help: 'Size of cache in bytes',
    labelNames: ['cache_layer']
  });
  
  // AI model metrics
  static modelInferenceTime = new Histogram({
    name: 'i18n_model_inference_time_seconds',
    help: 'AI model inference time in seconds',
    labelNames: ['model_type', 'model_version'],
    buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5]
  });
  
  static modelMemoryUsage = new Gauge({
    name: 'i18n_model_memory_usage_bytes',
    help: 'Memory usage by AI models',
    labelNames: ['model_type']
  });
  
  // Business metrics
  static activeLanguages = new Gauge({
    name: 'i18n_active_languages_total',
    help: 'Number of active languages'
  });
  
  static translationCoverage = new Gauge({
    name: 'i18n_translation_coverage_ratio',
    help: 'Ratio of translated content',
    labelNames: ['service']
  });
  
  static userLanguagePreferences = new Counter({
    name: 'i18n_user_language_preferences_total',
    help: 'User language preferences',
    labelNames: ['language', 'source']
  });
  
  // Error metrics
  static translationErrors = new Counter({
    name: 'i18n_translation_errors_total',
    help: 'Total number of translation errors',
    labelNames: ['error_type', 'language']
  });
  
  // System metrics
  static systemMemory = new Gauge({
    name: 'i18n_system_memory_usage_bytes',
    help: 'System memory usage'
  });
  
  static systemCPU = new Gauge({
    name: 'i18n_system_cpu_usage_percent',
    help: 'System CPU usage percentage'
  });
  
  static activeConnections = new Gauge({
    name: 'i18n_active_connections_total',
    help: 'Number of active connections'
  });
  
  static initialization() {
    // Register all metrics
    [
      this.translationRequests,
      this.translationDuration,
      this.translationQuality,
      this.detectionRequests,
      this.detectionAccuracy,
      this.cacheHits,
      this.cacheMisses,
      this.cacheSize,
      this.modelInferenceTime,
      this.modelMemoryUsage,
      this.activeLanguages,
      this.translationCoverage,
      this.userLanguagePreferences,
      this.translationErrors,
      this.systemMemory,
      this.systemCPU,
      this.activeConnections
    ].forEach(metric => this.registry.registerMetric(metric));
    
    // Start system metrics collection
    this.startSystemMetricsCollection();
    
    this.logger.log('Metrics system initialized');
  }
  
  private static startSystemMetricsCollection() {
    setInterval(() => {
      // System memory
      const totalMem = os.totalmem();
      const freeMem = os.freemem();
      const usedMem = totalMem - freeMem;
      this.systemMemory.set(usedMem);
      
      // System CPU (simplified)
      const loadAvg = os.loadavg()[0];
      const cpuCount = os.cpus().length;
      const cpuUsage = (loadAvg / cpuCount) * 100;
      this.systemCPU.set(cpuUsage);
      
    }, 10000); // Every 10 seconds
  }
  
  static async getMetrics(): Promise<string> {
    return this.registry.metrics();
  }
  
  static recordTranslation(
    targetLang: string,
    sourceLang: string,
    service: string,
    cacheStatus: 'hit' | 'miss',
    duration: number,
    quality?: number
  ) {
    this.translationRequests.inc({
      target_lang: targetLang,
      source_lang: sourceLang,
      service,
      cache_status: cacheStatus
    });
    
    this.translationDuration.observe({
      target_lang: targetLang,
      source_lang: sourceLang
    }, duration);
    
    if (quality !== undefined) {
      this.translationQuality.observe({
        target_lang: targetLang,
        source_lang: sourceLang,
        model_version: '1.0.0' // This should be dynamic
      }, quality);
    }
    
    // Record cache metrics
    if (cacheStatus === 'hit') {
      this.cacheHits.inc({ cache_layer: 'redis', type: 'translation' });
    } else {
      this.cacheMisses.inc({ cache_layer: 'redis', type: 'translation' });
    }
  }
  
  static recordDetection(method: string, accuracy: number, duration: number) {
    this.detectionRequests.inc({ method, accuracy: accuracy > 0.9 ? 'high' : 'low' });
    this.detectionAccuracy.observe({ method }, accuracy);
  }
  
  static recordError(errorType: string, language: string) {
    this.translationErrors.inc({ error_type: errorType, language });
  }
  
  static updateActiveLanguages(count: number) {
    this.activeLanguages.set(count);
  }
  
  static updateTranslationCoverage(service: string, coverage: number) {
    this.translationCoverage.set({ service }, coverage);
  }
  
  static recordUserLanguagePreference(language: string, source: string) {
    this.userLanguagePreferences.inc({ language, source });
  }
  
  static recordModelInference(modelType: string, duration: number, memoryUsage: number) {
    this.modelInferenceTime.observe({ model_type: modelType, model_version: '1.0.0' }, duration);
    this.modelMemoryUsage.set({ model_type: modelType }, memoryUsage);
  }
  
  static updateActiveConnections(count: number) {
    this.activeConnections.set(count);
  }
  
  static updateCacheSize(layer: string, size: number) {
    this.cacheSize.set({ cache_layer: layer }, size);
  }
}