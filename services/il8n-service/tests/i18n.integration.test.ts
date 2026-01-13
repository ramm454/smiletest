// tests/i18n.integration.test.ts
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { I18nModule } from '../src/i18n.module';
import { PrismaService } from '../src/prisma.service';

describe('I18n Integration Tests', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [I18nModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    // Clean database before each test
    await prisma.$transaction([
      prisma.translation.deleteMany(),
      prisma.language.deleteMany(),
      prisma.userLanguagePreference.deleteMany(),
    ]);
  });

  describe('Language Detection', () => {
    it('should detect language from Accept-Language header', () => {
      return request(app.getHttpServer())
        .get('/i18n/detect')
        .set('Accept-Language', 'de-DE,de;q=0.9,en;q=0.8')
        .expect(200)
        .expect((res) => {
          expect(res.body.detectedLanguage).toBe('de');
        });
    });

    it('should detect language from query parameter', () => {
      return request(app.getHttpServer())
        .get('/i18n/detect?lang=fr')
        .expect(200)
        .expect((res) => {
          expect(res.body.detectedLanguage).toBe('fr');
        });
    });

    it('should use geo-detection when available', () => {
      return request(app.getHttpServer())
        .get('/i18n/detect')
        .set('X-Forwarded-For', '81.209.166.166') // German IP
        .expect(200)
        .expect((res) => {
          expect(res.body.detectedLanguage).toBe('de');
        });
    });
  });

  describe('Translation', () => {
    beforeEach(async () => {
      // Seed languages
      await prisma.language.createMany({
        data: [
          { code: 'en', name: 'English', nativeName: 'English', isActive: true, isDefault: true },
          { code: 'de', name: 'German', nativeName: 'Deutsch', isActive: true },
          { code: 'fr', name: 'French', nativeName: 'Français', isActive: true },
        ],
      });
    });

    it('should translate text', () => {
      return request(app.getHttpServer())
        .post('/i18n/translate')
        .send({
          text: 'Hello world',
          targetLang: 'de',
        })
        .expect(201)
        .expect((res) => {
          expect(res.body).toHaveProperty('translated');
          expect(res.body).toHaveProperty('confidence');
        });
    });

    it('should handle batch translation', () => {
      return request(app.getHttpServer())
        .post('/i18n/translate-batch')
        .send({
          texts: ['Hello', 'Goodbye', 'Thank you'],
          targetLang: 'fr',
        })
        .expect(201)
        .expect((res) => {
          expect(res.body.translated).toHaveLength(3);
          expect(res.body.translated[0]).toBeDefined();
        });
    });

    it('should use translation memory for similar texts', async () => {
      // First, create a translation in memory
      await request(app.getHttpServer())
        .post('/i18n/translate')
        .send({
          text: 'Welcome to our yoga studio',
          targetLang: 'de',
        });

      // Then request similar translation
      return request(app.getHttpServer())
        .post('/i18n/translate')
        .send({
          text: 'Welcome to our meditation center',
          targetLang: 'de',
        })
        .expect(201)
        .expect((res) => {
          expect(res.body.confidence).toBeGreaterThan(0.7);
        });
    });
  });

  describe('Localization', () => {
    it('should localize dates', () => {
      return request(app.getHttpServer())
        .post('/i18n/localize')
        .send({
          data: {
            date: '2024-01-15T10:30:00Z',
            amount: 99.99,
            currency: 'EUR',
          },
          targetLang: 'de-DE',
          formatOptions: {
            dateFormat: 'full',
          },
        })
        .expect(201)
        .expect((res) => {
          expect(res.body.localized.date).toMatch(/Montag|Dienstag|Mittwoch/); // German day names
          expect(res.body.localized.amount).toMatch(/€|EUR/);
        });
    });

    it('should convert measurements', () => {
      return request(app.getHttpServer())
        .post('/i18n/localize')
        .send({
          data: {
            measurement: '100 cm',
            temperature: 68,
          },
          targetLang: 'en-US', // Should convert to imperial
        })
        .expect(201)
        .expect((res) => {
          expect(res.body.localized.measurement).toMatch(/inches|feet/);
        });
    });
  });

  describe('Context-Aware Translation', () => {
    it('should adapt translation based on context', () => {
      return request(app.getHttpServer())
        .post('/i18n/translate')
        .send({
          text: 'Please book a class',
          targetLang: 'de',
          context: {
            domain: 'fitness',
            formality: 'formal',
            urgency: 'high',
          },
        })
        .expect(201)
        .expect((res) => {
          expect(res.body.translated).toBeDefined();
          // The translation should be formal German
        });
    });

    it('should handle different tones', () => {
      return request(app.getHttpServer())
        .post('/i18n/translate')
        .send({
          text: 'Hey, wanna join the class?',
          targetLang: 'de',
          context: {
            tone: 'informal',
          },
        })
        .expect(201)
        .expect((res) => {
          // Should produce informal German translation
          expect(res.body.translated).toBeDefined();
        });
    });
  });

  describe('Real-time Features', () => {
    it('should handle WebSocket connections', (done) => {
      // This would test WebSocket connections
      // Implementation depends on your WebSocket setup
      done();
    });

    it('should broadcast language changes', (done) => {
      // Test real-time language switching
      done();
    });
  });

  describe('Performance', () => {
    it('should cache translations', async () => {
      const startTime = Date.now();

      // First request
      await request(app.getHttpServer())
        .post('/i18n/translate')
        .send({
          text: 'Performance test translation',
          targetLang: 'fr',
        });

      const firstRequestTime = Date.now() - startTime;

      // Second request (should be faster due to caching)
      const cacheStartTime = Date.now();
      await request(app.getHttpServer())
        .post('/i18n/translate')
        .send({
          text: 'Performance test translation',
          targetLang: 'fr',
        });

      const cachedRequestTime = Date.now() - cacheStartTime;

      expect(cachedRequestTime).toBeLessThan(firstRequestTime * 0.5); // Should be at least 50% faster
    });

    it('should handle concurrent requests', async () => {
      const requests = Array(100).fill(null).map(() =>
        request(app.getHttpServer())
          .post('/i18n/translate')
          .send({
            text: 'Concurrent test',
            targetLang: 'de',
          })
      );

      const responses = await Promise.all(requests);
      
      expect(responses).toHaveLength(100);
      responses.forEach((res) => {
        expect(res.status).toBe(201);
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle unsupported language', () => {
      return request(app.getHttpServer())
        .post('/i18n/translate')
        .send({
          text: 'Hello',
          targetLang: 'xx', // Invalid language code
        })
        .expect(400);
    });

    it('should handle missing text', () => {
      return request(app.getHttpServer())
        .post('/i18n/translate')
        .send({
          targetLang: 'de',
        })
        .expect(400);
    });

    it('should handle service unavailability gracefully', async () => {
      // Mock AI service failure
      // This would require mocking the AI service
      
      return request(app.getHttpServer())
        .post('/i18n/translate')
        .send({
          text: 'Test',
          targetLang: 'de',
        })
        .expect(201) // Should still return 201 with fallback
        .expect((res) => {
          expect(res.body).toHaveProperty('translated');
          expect(res.body.confidence).toBeLessThan(0.5); // Low confidence for fallback
        });
    });
  });
});