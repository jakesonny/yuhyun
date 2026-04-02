import {
  BadRequestException,
  Injectable,
  OnModuleDestroy,
  OnModuleInit,
  UnauthorizedException,
} from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'crypto';
import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { Pool } from 'pg';

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
export class AppService implements OnModuleInit, OnModuleDestroy {
  private readonly sqliteDb?: Database.Database;
  private readonly pgPool?: Pool;
  private readonly storageMode: 'postgres' | 'sqlite';

  constructor() {
    if (process.env.DATABASE_URL) {
      this.storageMode = 'postgres';
      this.pgPool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: process.env.PGSSL_DISABLE === 'true' ? false : { rejectUnauthorized: false },
      });
      return;
    }

    this.storageMode = 'sqlite';
    const dbPath = process.env.INGEST_DB_PATH ?? path.resolve(process.cwd(), 'data', 'ingest.db');
    const dbDir = path.dirname(dbPath);
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }
    this.sqliteDb = new Database(dbPath);
  }

  async onModuleInit() {
    await this.initSchema();
  }

  async onModuleDestroy() {
    if (this.pgPool) {
      await this.pgPool.end();
    }
  }

  private async initSchema() {
    if (this.storageMode === 'postgres') {
      await this.pgPool!.query(`
        CREATE TABLE IF NOT EXISTS ingest_dedup (
          idempotency_key TEXT PRIMARY KEY,
          created_at TIMESTAMPTZ NOT NULL
        );

        CREATE TABLE IF NOT EXISTS raw_logs (
          id BIGSERIAL PRIMARY KEY,
          site_id TEXT NOT NULL,
          agent_id TEXT NOT NULL,
          source_file TEXT NOT NULL,
          line_offset BIGINT NOT NULL,
          occurred_at TIMESTAMPTZ NOT NULL,
          raw_line TEXT NOT NULL,
          parsed_payload_json JSONB,
          idempotency_key TEXT NOT NULL UNIQUE,
          received_at TIMESTAMPTZ NOT NULL
        );
      `);
      return;
    }

    this.sqliteDb!.exec(`
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

  async ingest(payload: IngestBody, apiKeyHeader: string | undefined) {
    this.validateRequiredFields(payload);
    this.validateAuth(payload, apiKeyHeader);

    const inserted = await this.insertIngestRecord(payload);
    if (!inserted) {
      return {
        status: 'duplicate',
        idempotencyKey: payload.idempotencyKey,
      };
    }

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
      storageMode: this.storageMode,
      timestamp: new Date().toISOString(),
    };
  }

  async ingestStats() {
    const stats = await this.getStats();

    return {
      storageMode: this.storageMode,
      dedupCount: stats.dedupCount,
      rawLogCount: stats.rawLogCount,
    };
  }

  private async insertIngestRecord(payload: IngestBody): Promise<boolean> {
    const now = new Date().toISOString();

    if (this.storageMode === 'postgres') {
      const result = await this.pgPool!.query(
        `
          WITH inserted_dedup AS (
            INSERT INTO ingest_dedup (idempotency_key, created_at)
            VALUES ($1, $2)
            ON CONFLICT (idempotency_key) DO NOTHING
            RETURNING idempotency_key
          )
          INSERT INTO raw_logs (
            site_id, agent_id, source_file, line_offset, occurred_at,
            raw_line, parsed_payload_json, idempotency_key, received_at
          )
          SELECT $3, $4, $5, $6, $7, $8, $9::jsonb, $1, $2
          WHERE EXISTS (SELECT 1 FROM inserted_dedup)
          RETURNING id
        `,
        [
          payload.idempotencyKey,
          now,
          payload.siteId,
          payload.agentId,
          payload.sourceFile,
          payload.offset,
          payload.occurredAt,
          payload.rawLine,
          payload.parsedPayload ? JSON.stringify(payload.parsedPayload) : null,
        ],
      );
      return (result.rowCount ?? 0) > 0;
    }

    const dedupResult = this.sqliteDb!
      .prepare(
        `
          INSERT OR IGNORE INTO ingest_dedup (idempotency_key, created_at)
          VALUES (?, ?)
        `,
      )
      .run(payload.idempotencyKey, now);

    if (dedupResult.changes === 0) {
      return false;
    }

    this.sqliteDb!
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
        now,
      );
    return true;
  }

  private async getStats(): Promise<{ dedupCount: number; rawLogCount: number }> {
    if (this.storageMode === 'postgres') {
      const dedup = await this.pgPool!.query<{ count: string }>('SELECT COUNT(1)::text AS count FROM ingest_dedup');
      const raw = await this.pgPool!.query<{ count: string }>('SELECT COUNT(1)::text AS count FROM raw_logs');
      return {
        dedupCount: Number(dedup.rows[0]?.count ?? 0),
        rawLogCount: Number(raw.rows[0]?.count ?? 0),
      };
    }

    const dedupCountRow = this.sqliteDb!
      .prepare('SELECT COUNT(1) AS count FROM ingest_dedup')
      .get() as { count: number };
    const rawLogCountRow = this.sqliteDb!
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
