// src/modules/context/context-processor.service.ts
import { Injectable, Logger } from '@nestjs/common';
import * as natural from 'natural';
import * as compromise from 'compromise';
import * as sentiment from 'sentiment';

@Injectable()
export class ContextProcessorService {
  private readonly logger = new Logger(ContextProcessorService.name);
  private sentimentAnalyzer = new sentiment();
  private classifier = new natural.BayesClassifier();
  private posTagger = new natural.BrillPOSTagger(
    natural.BrillPOSTagger.defaultRules,
    natural.BrillPOSTagger.defaultLexicon
  );
  
  constructor() {
    this.initializeClassifier();
  }
  
  private initializeClassifier() {
    // Train classifier on common domains
    const trainingData = [
      { text: 'yoga class schedule', category: 'fitness' },
      { text: 'spa treatment booking', category: 'wellness' },
      { text: 'payment confirmation', category: 'finance' },
      { text: 'user registration', category: 'authentication' },
      { text: 'class cancellation', category: 'booking' },
      { text: 'instructor profile', category: 'profile' },
      { text: 'meditation session', category: 'wellness' },
      { text: 'product purchase', category: 'ecommerce' },
      { text: 'customer support', category: 'support' },
      { text: 'system notification', category: 'system' }
    ];
    
    trainingData.forEach(item => {
      this.classifier.addDocument(item.text, item.category);
    });
    
    this.classifier.train();
  }
  
  async analyzeTextContext(text: string, metadata?: any): Promise<ContextAnalysis> {
    const analysis: ContextAnalysis = {
      domain: this.classifier.classify(text),
      sentiment: this.analyzeSentiment(text),
      entities: this.extractEntities(text),
      keywords: this.extractKeywords(text),
      tone: this.analyzeTone(text),
      complexity: this.analyzeComplexity(text),
      formality: this.analyzeFormality(text),
      culturalReferences: this.detectCulturalReferences(text),
      technicality: this.analyzeTechnicality(text),
      urgency: this.analyzeUrgency(text),
      intent: this.detectIntent(text)
    };
    
    // Enhance with metadata if available
    if (metadata) {
      analysis.metadata = metadata;
      
      if (metadata.userLocation) {
        analysis.culturalContext = this.getCulturalContext(metadata.userLocation);
      }
      
      if (metadata.userPreferences) {
        analysis.personalization = this.getPersonalizationContext(metadata.userPreferences);
      }
    }
    
    return analysis;
  }
  
  async adaptTranslationToContext(
    translation: string,
    sourceContext: ContextAnalysis,
    targetContext: ContextAnalysis,
    targetLanguage: string
  ): Promise<string> {
    let adapted = translation;
    
    // 1. Adapt formality
    adapted = this.adaptFormality(adapted, sourceContext.formality, targetContext.formality, targetLanguage);
    
    // 2. Adapt tone
    adapted = this.adaptTone(adapted, sourceContext.tone, targetContext.tone);
    
    // 3. Adapt cultural references
    adapted = this.adaptCulturalReferences(adapted, sourceContext.culturalReferences, targetContext.culturalReferences);
    
    // 4. Adapt technical terms
    adapted = this.adaptTechnicalTerms(adapted, sourceContext.technicality, targetContext.technicality);
    
    // 5. Adapt for domain-specific terminology
    adapted = this.adaptDomainTerminology(adapted, sourceContext.domain, targetContext.domain);
    
    // 6. Adjust for sentiment
    adapted = this.adjustForSentiment(adapted, sourceContext.sentiment, targetContext.sentiment);
    
    // 7. Localize measurements and formats
    adapted = this.localizeMeasurements(adapted, targetLanguage);
    
    // 8. Adjust sentence structure for complexity
    if (targetContext.complexity < sourceContext.complexity) {
      adapted = this.simplifyText(adapted, targetContext.complexity);
    }
    
    return adapted;
  }
  
  private analyzeSentiment(text: string): SentimentAnalysis {
    const result = this.sentimentAnalyzer.analyze(text);
    
    return {
      score: result.score,
      comparative: result.comparative,
      positive: result.positive,
      negative: result.negative,
      neutral: result.neutral
    };
  }
  
  private extractEntities(text: string): Entity[] {
    const doc = compromise(text);
    const entities: Entity[] = [];
    
    // Extract people
    doc.people().json().forEach((person: any) => {
      entities.push({
        type: 'person',
        text: person.text,
        normalized: person.normal,
        confidence: 0.9
      });
    });
    
    // Extract places
    doc.places().json().forEach((place: any) => {
      entities.push({
        type: 'place',
        text: place.text,
        normalized: place.normal,
        confidence: 0.8
      });
    });
    
    // Extract organizations
    doc.organizations().json().forEach((org: any) => {
      entities.push({
        type: 'organization',
        text: org.text,
        normalized: org.normal,
        confidence: 0.7
      });
    });
    
    // Extract dates
    doc.dates().json().forEach((date: any) => {
      entities.push({
        type: 'date',
        text: date.text,
        normalized: date.normal,
        confidence: 0.95
      });
    });
    
    // Extract numbers
    doc.numbers().json().forEach((num: any) => {
      entities.push({
        type: 'number',
        text: num.text,
        normalized: num.normal,
        confidence: 1.0
      });
    });
    
    return entities;
  }
  
  private extractKeywords(text: string): Keyword[] {
    const tfidf = new natural.TfIdf();
    tfidf.addDocument(text);
    
    const keywords: Keyword[] = [];
    const tokens = new natural.WordTokenizer().tokenize(text.toLowerCase());
    const stopwords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for']);
    
    tfidf.listTerms(0).forEach(term => {
      if (!stopwords.has(term.term) && term.term.length > 2) {
        keywords.push({
          term: term.term,
          tfidf: term.tfidf,
          frequency: tokens.filter(t => t === term.term).length
        });
      }
    });
    
    return keywords.sort((a, b) => b.tfidf - a.tfidf).slice(0, 10);
  }
  
  private analyzeTone(text: string): Tone {
    const sentiment = this.analyzeSentiment(text);
    const words = text.toLowerCase().split(/\s+/);
    
    const toneIndicators = {
      formal: ['respectfully', 'sincerely', 'hereby', 'therefore'],
      informal: ['hey', 'yo', 'lol', 'omg', 'btw'],
      polite: ['please', 'thank you', 'kindly', 'appreciate'],
      urgent: ['immediately', 'asap', 'urgent', 'critical'],
      positive: ['great', 'excellent', 'wonderful', 'amazing'],
      negative: ['unfortunately', 'sorry', 'apologize', 'regret']
    };
    
    const scores: Record<string, number> = {};
    
    Object.entries(toneIndicators).forEach(([tone, indicators]) => {
      scores[tone] = indicators.filter(indicator => 
        words.some(word => word.includes(indicator))
      ).length;
    });
    
    // Determine primary tone
    let primaryTone = 'neutral';
    let maxScore = 0;
    
    for (const [tone, score] of Object.entries(scores)) {
      if (score > maxScore) {
        maxScore = score;
        primaryTone = tone;
      }
    }
    
    // Use sentiment to refine tone
    if (sentiment.score > 2) {
      primaryTone = 'positive';
    } else if (sentiment.score < -2) {
      primaryTone = 'negative';
    }
    
    return {
      primary: primaryTone as any,
      scores,
      confidence: maxScore / Math.max(...Object.values(scores)) || 0
    };
  }
  
  private analyzeComplexity(text: string): number {
    // Flesch-Kincaid readability score
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
    const words = text.split(/\s+/).filter(w => w.length > 0);
    const syllables = words.reduce((sum, word) => sum + this.countSyllables(word), 0);
    
    if (sentences.length === 0 || words.length === 0) return 0;
    
    const flesch = 206.835 - 1.015 * (words.length / sentences.length) - 84.6 * (syllables / words.length);
    
    // Normalize to 0-1 scale (higher = more complex)
    return Math.min(Math.max((100 - flesch) / 100, 0), 1);
  }
  
  private analyzeFormality(text: string): number {
    const formalMarkers = [
      'shall', 'must', 'therefore', 'however', 'moreover', 'furthermore',
      'nevertheless', 'consequently', 'accordingly', 'notwithstanding'
    ];
    
    const informalMarkers = [
      'gonna', 'wanna', 'gotta', 'kinda', 'sorta', 'ain\'t', 'y\'all',
      'hey', 'yo', 'lol', 'omg', 'btw', 'imo', 'tbh'
    ];
    
    const words = text.toLowerCase().split(/\s+/);
    const formalCount = formalMarkers.filter(marker => words.includes(marker)).length;
    const informalCount = informalMarkers.filter(marker => words.includes(marker)).length;
    
    // Also consider sentence length and structure
    const avgSentenceLength = text.split(/[.!?]+/).filter(s => s.trim()).reduce((sum, s) => sum + s.split(/\s+/).length, 0) / 
                             text.split(/[.!?]+/).filter(s => s.trim()).length || 1;
    
    const formalityScore = (formalCount / (formalCount + informalCount + 1)) * 0.7 + 
                          (Math.min(avgSentenceLength / 20, 1)) * 0.3;
    
    return formalityScore;
  }
  
  private detectCulturalReferences(text: string): CulturalReference[] {
    const references: CulturalReference[] = [];
    
    // Common cultural references
    const culturalPatterns = [
      { pattern: /\b(thanksgiving|christmas|easter|hanukkah|diwali|ramadan)\b/i, type: 'holiday' },
      { pattern: /\b(super bowl|world cup|olympics|world series)\b/i, type: 'sport_event' },
      { pattern: /\b(dollar|euro|yen|pound|rupee)\b/i, type: 'currency' },
      { pattern: /\b(miles|kilometers|pounds|kilograms|fahrenheit|celsius)\b/i, type: 'measurement' },
      { pattern: /\b(january|february|march|april|may|june|july|august|september|october|november|december)\b/i, type: 'date_format' }
    ];
    
    culturalPatterns.forEach(pattern => {
      const matches = text.match(pattern.pattern);
      if (matches) {
        matches.forEach(match => {
          references.push({
            type: pattern.type,
            reference: match,
            isCultureSpecific: true
          });
        });
      }
    });
    
    return references;
  }
  
  private analyzeTechnicality(text: string): number {
    // Load technical terms database (this would be from a file or database)
    const technicalTerms = [
      'api', 'endpoint', 'microservice', 'database', 'kubernetes', 'docker',
      'algorithm', 'protocol', 'encryption', 'authentication', 'authorization',
      'middleware', 'framework', 'library', 'dependency', 'deployment'
    ];
    
    const words = text.toLowerCase().split(/\s+/);
    const technicalCount = words.filter(word => technicalTerms.includes(word)).length;
    
    return Math.min(technicalCount / 10, 1); // Normalize to 0-1
  }
  
  private analyzeUrgency(text: string): number {
    const urgentIndicators = [
      'immediately', 'asap', 'urgent', 'critical', 'emergency',
      'now', 'today', 'deadline', 'time-sensitive', 'rush'
    ];
    
    const words = text.toLowerCase().split(/\s+/);
    const urgentCount = urgentIndicators.filter(indicator => words.includes(indicator)).length;
    
    // Also check for exclamation marks and capital letters
    const exclamationCount = (text.match(/!/g) || []).length;
    const allCapsCount = (text.match(/\b[A-Z]{2,}\b/g) || []).length;
    
    const urgencyScore = (urgentCount / 5 * 0.6) + 
                        (Math.min(exclamationCount / 3, 1) * 0.2) + 
                        (Math.min(allCapsCount / 2, 1) * 0.2);
    
    return Math.min(urgencyScore, 1);
  }
  
  private detectIntent(text: string): Intent {
    const intents = {
      booking: ['book', 'reserve', 'schedule', 'appointment', 'reservation'],
      inquiry: ['what', 'when', 'where', 'how', 'why', 'can', 'could', 'would'],
      complaint: ['problem', 'issue', 'error', 'broken', 'not working', 'complaint'],
      support: ['help', 'support', 'assistance', 'guidance'],
      purchase: ['buy', 'purchase', 'order', 'checkout', 'cart'],
      cancellation: ['cancel', 'refund', 'return', 'stop', 'terminate']
    };
    
    const textLower = text.toLowerCase();
    const scores: Record<string, number> = {};
    
    Object.entries(intents).forEach(([intent, keywords]) => {
      scores[intent] = keywords.filter(keyword => textLower.includes(keyword)).length;
    });
    
    // Determine primary intent
    let primaryIntent = 'informational';
    let maxScore = 0;
    
    for (const [intent, score] of Object.entries(scores)) {
      if (score > maxScore) {
        maxScore = score;
        primaryIntent = intent;
      }
    }
    
    return {
      primary: primaryIntent,
      scores,
      confidence: maxScore / Math.max(...Object.values(scores)) || 0
    };
  }
  
  private countSyllables(word: string): number {
    word = word.toLowerCase();
    if (word.length <= 3) return 1;
    
    word = word.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, '');
    word = word.replace(/^y/, '');
    
    const syllables = word.match(/[aeiouy]{1,2}/g);
    return syllables ? syllables.length : 1;
  }
  
  private getCulturalContext(location: string): CulturalContext {
    // This would use a database of cultural norms
    const culturalData: Record<string, CulturalContext> = {
      'US': {
        dateFormat: 'MM/DD/YYYY',
        timeFormat: '12-hour',
        measurement: 'imperial',
        currency: 'USD',
        formality: 'medium',
        greeting: 'Hello'
      },
      'DE': {
        dateFormat: 'DD.MM.YYYY',
        timeFormat: '24-hour',
        measurement: 'metric',
        currency: 'EUR',
        formality: 'high',
        greeting: 'Guten Tag'
      },
      'JP': {
        dateFormat: 'YYYY/MM/DD',
        timeFormat: '24-hour',
        measurement: 'metric',
        currency: 'JPY',
        formality: 'very high',
        greeting: 'こんにちは'
      }
    };
    
    return culturalData[location] || {
      dateFormat: 'YYYY-MM-DD',
      timeFormat: '24-hour',
      measurement: 'metric',
      currency: 'USD',
      formality: 'medium',
      greeting: 'Hello'
    };
  }
  
  private getPersonalizationContext(preferences: any): PersonalizationContext {
    return {
      preferredStyle: preferences.preferredStyle || 'neutral',
      complexityLevel: preferences.complexityLevel || 'medium',
      tonePreference: preferences.tonePreference || 'neutral',
      culturalAdaptation: preferences.culturalAdaptation || true,
      accessibility: preferences.accessibility || {}
    };
  }
  
  private adaptFormality(
    text: string,
    sourceFormality: number,
    targetFormality: number,
    language: string
  ): string {
    if (Math.abs(sourceFormality - targetFormality) < 0.2) {
      return text;
    }
    
    let adapted = text;
    
    if (targetFormality > sourceFormality) {
      // Make more formal
      if (language === 'en') {
        adapted = adapted.replace(/\b(can't|won't|don't|isn't|aren't|wasn't|weren't)\b/gi, match => {
          const formalMap: Record<string, string> = {
            "can't": "cannot",
            "won't": "will not",
            "don't": "do not",
            "isn't": "is not",
            "aren't": "are not",
            "wasn't": "was not",
            "weren't": "were not"
          };
          return formalMap[match.toLowerCase()] || match;
        });
        
        adapted = adapted.replace(/\b(gonna|wanna|gotta)\b/gi, match => {
          const formalMap: Record<string, string> = {
            "gonna": "going to",
            "wanna": "want to",
            "gotta": "have to"
          };
          return formalMap[match.toLowerCase()] || match;
        });
      }
    } else {
      // Make less formal
      // Implement informal adaptations
    }
    
    return adapted;
  }
  
  private adaptTone(text: string, sourceTone: Tone, targetTone: Tone): string {
    // Implementation would adjust wording based on tone differences
    return text;
  }
  
  private adaptCulturalReferences(
    text: string,
    sourceReferences: CulturalReference[],
    targetReferences: CulturalReference[]
  ): string {
    // Replace culture-specific references with neutral or target-culture equivalents
    let adapted = text;
    
    sourceReferences.forEach(ref => {
      if (ref.isCultureSpecific) {
        const replacement = this.getCulturalReplacement(ref.reference, ref.type);
        if (replacement) {
          adapted = adapted.replace(new RegExp(ref.reference, 'gi'), replacement);
        }
      }
    });
    
    return adapted;
  }
  
  private adaptTechnicalTerms(
    text: string,
    sourceTechnicality: number,
    targetTechnicality: number
  ): string {
    if (targetTechnicality < sourceTechnicality) {
      // Simplify technical terms
      const technicalMap: Record<string, string> = {
        'api': 'interface',
        'endpoint': 'connection point',
        'microservice': 'small service',
        'database': 'data storage',
        'kubernetes': 'container system',
        'docker': 'container tool'
      };
      
      let adapted = text;
      Object.entries(technicalMap).forEach(([tech, simple]) => {
        adapted = adapted.replace(new RegExp(`\\b${tech}\\b`, 'gi'), simple);
      });
      
      return adapted;
    }
    
    return text;
  }
  
  private adaptDomainTerminology(text: string, sourceDomain: string, targetDomain: string): string {
    // Domain-specific terminology adaptation
    // This would use a domain terminology database
    return text;
  }
  
  private adjustForSentiment(text: string, sourceSentiment: SentimentAnalysis, targetSentiment: SentimentAnalysis): string {
    // Adjust wording to match target sentiment if needed
    return text;
  }
  
  private localizeMeasurements(text: string, targetLanguage: string): string {
    // Convert measurements based on target language/culture
    let localized = text;
    
    // Example: Convert miles to kilometers for metric countries
    const metricCountries = ['DE', 'FR', 'JP', 'CN', 'RU'];
    const countryCode = targetLanguage.split('-')[1] || 'US';
    
    if (metricCountries.includes(countryCode)) {
      localized = localized.replace(/(\d+)\s*miles/gi, (match, miles) => {
        const km = Math.round(Number(miles) * 1.60934);
        return `${km} kilometers`;
      });
      
      localized = localized.replace(/(\d+)\s*°F/gi, (match, fahrenheit) => {
        const celsius = Math.round((Number(fahrenheit) - 32) * 5/9);
        return `${celsius}°C`;
      });
    }
    
    return localized;
  }
  
  private simplifyText(text: string, targetComplexity: number): string {
    // Implement text simplification
    return text;
  }
  
  private getCulturalReplacement(reference: string, type: string): string | null {
    const replacements: Record<string, Record<string, string>> = {
      holiday: {
        'thanksgiving': 'autumn holiday',
        'christmas': 'winter holiday',
        'easter': 'spring holiday'
      },
      currency: {
        'dollar': 'local currency',
        'euro': 'local currency',
        'yen': 'local currency'
      }
    };
    
    return replacements[type]?.[reference.toLowerCase()] || null;
  }
}

// Types for context analysis
interface ContextAnalysis {
  domain: string;
  sentiment: SentimentAnalysis;
  entities: Entity[];
  keywords: Keyword[];
  tone: Tone;
  complexity: number;
  formality: number;
  culturalReferences: CulturalReference[];
  technicality: number;
  urgency: number;
  intent: Intent;
  metadata?: any;
  culturalContext?: CulturalContext;
  personalization?: PersonalizationContext;
}

interface SentimentAnalysis {
  score: number;
  comparative: number;
  positive: string[];
  negative: string[];
  neutral: string[];
}

interface Entity {
  type: string;
  text: string;
  normalized?: string;
  confidence: number;
}

interface Keyword {
  term: string;
  tfidf: number;
  frequency: number;
}

interface Tone {
  primary: 'formal' | 'informal' | 'polite' | 'urgent' | 'positive' | 'negative' | 'neutral';
  scores: Record<string, number>;
  confidence: number;
}

interface CulturalReference {
  type: string;
  reference: string;
  isCultureSpecific: boolean;
}

interface Intent {
  primary: string;
  scores: Record<string, number>;
  confidence: number;
}

interface CulturalContext {
  dateFormat: string;
  timeFormat: string;
  measurement: string;
  currency: string;
  formality: string;
  greeting: string;
}

interface PersonalizationContext {
  preferredStyle: string;
  complexityLevel: string;
  tonePreference: string;
  culturalAdaptation: boolean;
  accessibility: Record<string, any>;
}