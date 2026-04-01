import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'crypto';
import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

type IngestBody = {
  siteId: string;
  agentId: string;
  sourceFile: string;
  offset: number;
  occurredAt: string;
  rawLine: string;
  parsedPayload?: Record<string, unknown>;
  idempotencyKey: string;
  signature: string;
};

@Injectable()
export class AppService {
  private readonly db: Database.Database;

  constructor() {
    const dbPath = process.env.INGEST_DB_PATH ?? path.resolve(process.cwd(), 'data', 'ingest.db');
    const dbDir = path.dirname(dbPath);
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }

    this.db = new Database(dbPath);
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS ingest_dedup (
        idempotency_key TEXT PRIMARY KEY,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS raw_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        site_id TEXT NOT NULL,
        agent_id TEXT NOT NULL,
        source_file TEXT NOT NULL,
        line_offset INTEGER NOT NULL,
        occurred_at TEXT NOT NULL,
        raw_line TEXT NOT NULL,
        parsed_payload_json TEXT,
        idempotency_key TEXT NOT NULL UNIQUE,
        received_at TEXT NOT NULL
      );
    `);
  }

  ingest(payload: IngestBody, apiKeyHeader: string | undefined) {
    this.validateRequiredFields(payload);
    this.validateAuth(payload, apiKeyHeader);

    const dedupResult = this.db
      .prepare(
        `
          INSERT OR IGNORE INTO ingest_dedup (idempotency_key, created_at)
          VALUES (?, ?)
        `,
      )
      .run(payload.idempotencyKey, new Date().toISOString());

    if (dedupResult.changes === 0) {
      return {
        status: 'duplicate',
        idempotencyKey: payload.idempotencyKey,
      };
    }

    this.db
      .prepare(
        `
          INSERT INTO raw_logs (
            site_id, agent_id, source_file, line_offset, occurred_at,
            raw_line, parsed_payload_json, idempotency_key, received_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
      )
      .run(
        payload.siteId,
        payload.agentId,
        payload.sourceFile,
        payload.offset,
        payload.occurredAt,
        payload.rawLine,
        payload.parsedPayload ? JSON.stringify(payload.parsedPayload) : null,
        payload.idempotencyKey,
        new Date().toISOString(),
      );

    return {
      status: 'accepted',
      idempotencyKey: payload.idempotencyKey,
      receivedAt: new Date().toISOString(),
    };
  }

  health() {
    return {
      ok: true,
      service: 'backend',
      timestamp: new Date().toISOString(),
    };
  }

  ingestStats() {
    const dedupCountRow = this.db
      .prepare('SELECT COUNT(1) AS count FROM ingest_dedup')
      .get() as { count: number };
    const rawLogCountRow = this.db
      .prepare('SELECT COUNT(1) AS count FROM raw_logs')
      .get() as { count: number };

    return {
      dedupCount: dedupCountRow.count,
      rawLogCount: rawLogCountRow.count,
    };
  }

  private validateRequiredFields(payload: IngestBody) {
    const requiredFields: Array<keyof IngestBody> = [
      'siteId',
      'agentId',
      'sourceFile',
      'offset',
      'occurredAt',
      'rawLine',
      'idempotencyKey',
      'signature',
    ];

    for (const field of requiredFields) {
      const value = payload[field];
      if (value === undefined || value === null || value === '') {
        throw new BadRequestException(`Missing required field: ${field}`);
      }
    }

    if (!Number.isFinite(payload.offset)) {
      throw new BadRequestException('offset must be a valid number');
    }
  }

  private validateAuth(payload: IngestBody, apiKeyHeader?: string) {
    const expectedApiKey = process.env.AGENT_API_KEY;
    if (!expectedApiKey) {
      throw new UnauthorizedException('AGENT_API_KEY is not configured on server');
    }

    if (apiKeyHeader !== expectedApiKey) {
      throw new UnauthorizedException('Invalid API key');
    }

    const allowedAgentId = process.env.ALLOWED_AGENT_ID;
    if (allowedAgentId && payload.agentId !== allowedAgentId) {
      throw new UnauthorizedException('This agent is not allowed');
    }

    const hmacSecret = process.env.AGENT_HMAC_SECRET;
    if (!hmacSecret) {
      throw new UnauthorizedException('AGENT_HMAC_SECRET is not configured on server');
    }

    const base = `${payload.idempotencyKey}:${payload.occurredAt}:${payload.rawLine}`;
    const expectedSignature = createHmac('sha256', hmacSecret).update(base).digest('hex');
    const expected = Buffer.from(expectedSignature, 'utf8');
    const provided = Buffer.from(payload.signature, 'utf8');

    if (expected.length !== provided.length || !timingSafeEqual(expected, provided)) {
      throw new UnauthorizedException('Invalid signature');
    }
  }
}
