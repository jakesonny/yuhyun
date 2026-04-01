import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { createHmac } from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';

describe('Ingest API (e2e)', () => {
  let app: INestApplication<App>;
  let ingestDbPath = '';

  beforeEach(async () => {
    process.env.AGENT_API_KEY = 'test-api-key';
    process.env.AGENT_HMAC_SECRET = 'test-hmac-secret';
    process.env.ALLOWED_AGENT_ID = 'field-pc-001';
    ingestDbPath = path.join(
      os.tmpdir(),
      `ingest-test-${Date.now()}-${Math.random().toString(36).slice(2)}.db`,
    );
    process.env.INGEST_DB_PATH = ingestDbPath;

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
    if (ingestDbPath && fs.existsSync(ingestDbPath)) {
      fs.unlinkSync(ingestDbPath);
    }
  });

  it('accepts first ingest and returns duplicate on second', async () => {
    const idempotencyKey = 'key-001';
    const occurredAt = new Date().toISOString();
    const rawLine = 'S1,12.34';
    const signature = createHmac('sha256', process.env.AGENT_HMAC_SECRET ?? '')
      .update(`${idempotencyKey}:${occurredAt}:${rawLine}`)
      .digest('hex');

    const body = {
      siteId: 'site-001',
      agentId: 'field-pc-001',
      sourceFile: 'C:\\data\\measure.txt',
      offset: 12,
      occurredAt,
      rawLine,
      idempotencyKey,
      signature,
    };

    const first = await request(app.getHttpServer())
      .post('/api/ingest')
      .set('x-api-key', process.env.AGENT_API_KEY ?? '')
      .send(body)
      .expect(201);

    expect(first.body.status).toBe('accepted');

    const second = await request(app.getHttpServer())
      .post('/api/ingest')
      .set('x-api-key', process.env.AGENT_API_KEY ?? '')
      .send(body)
      .expect(201);

    expect(second.body.status).toBe('duplicate');
  });
});
