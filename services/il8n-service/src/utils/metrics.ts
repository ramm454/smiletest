// src/utils/metrics.ts
import { Counter, Histogram, register } from 'prom-client';

export const translationRequests = new Counter({
  name: 'i18n_translation_requests_total',
  help: 'Total number of translation requests',
  labelNames: ['target_lang', 'source_lang', 'service']
});

export const translationDuration = new Histogram({
  name: 'i18n_translation_duration_seconds',
  help: 'Duration of translation requests in seconds',
  labelNames: ['target_lang', 'source_lang'],
  buckets: [0.1, 0.5, 1, 2, 5]
});

export const detectionRequests = new Counter({
  name: 'i18n_detection_requests_total',
  help: 'Total number of language detection requests',
  labelNames: ['method']
});

export const aiModelAccuracy = new Histogram({
  name: 'i18n_ai_model_accuracy',
  help: 'Accuracy of AI model predictions',
  labelNames: ['model_type'],
  buckets: [0.5, 0.75, 0.9, 0.95, 0.99, 1.0]
});