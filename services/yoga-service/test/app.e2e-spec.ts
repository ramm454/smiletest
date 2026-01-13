import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';

describe('YogaService (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('/health (GET)', () => {
    return request(app.getHttpServer())
      .get('/health')
      .expect(200)
      .expect((res) => {
        expect(res.body).toHaveProperty('status', 'healthy');
        expect(res.body).toHaveProperty('service', 'yoga-service');
      });
  });

  it('/yoga/poses (GET)', () => {
    return request(app.getHttpServer())
      .get('/yoga/poses')
      .expect(200)
      .expect((res) => {
        expect(res.body).toHaveProperty('poses');
        expect(res.body).toHaveProperty('pagination');
      });
  });

  it('/yoga/sequences (GET)', () => {
    return request(app.getHttpServer())
      .get('/yoga/sequences')
      .expect(200)
      .expect((res) => {
        expect(res.body).toHaveProperty('sequences');
        expect(res.body).toHaveProperty('pagination');
      });
  });
});