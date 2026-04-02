"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppService = void 0;
const common_1 = require("@nestjs/common");
const crypto_1 = require("crypto");
const better_sqlite3_1 = __importDefault(require("better-sqlite3"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const pg_1 = require("pg");
let AppService = class AppService {
    sqliteDb;
    pgPool;
    storageMode;
    constructor() {
        if (process.env.DATABASE_URL) {
            this.storageMode = 'postgres';
            this.pgPool = new pg_1.Pool({
                connectionString: process.env.DATABASE_URL,
                ssl: process.env.PGSSL_DISABLE === 'true' ? false : { rejectUnauthorized: false },
            });
            return;
        }
        this.storageMode = 'sqlite';
        const dbPath = process.env.INGEST_DB_PATH ?? path_1.default.resolve(process.cwd(), 'data', 'ingest.db');
        const dbDir = path_1.default.dirname(dbPath);
        if (!fs_1.default.existsSync(dbDir)) {
            fs_1.default.mkdirSync(dbDir, { recursive: true });
        }
        this.sqliteDb = new better_sqlite3_1.default(dbPath);
    }
    async onModuleInit() {
        await this.initSchema();
    }
    async onModuleDestroy() {
        if (this.pgPool) {
            await this.pgPool.end();
        }
    }
    async initSchema() {
        if (this.storageMode === 'postgres') {
            await this.pgPool.query(`
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
        this.sqliteDb.exec(`
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
    async ingest(payload, apiKeyHeader) {
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
    async insertIngestRecord(payload) {
        const now = new Date().toISOString();
        if (this.storageMode === 'postgres') {
            const result = await this.pgPool.query(`
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
        `, [
                payload.idempotencyKey,
                now,
                payload.siteId,
                payload.agentId,
                payload.sourceFile,
                payload.offset,
                payload.occurredAt,
                payload.rawLine,
                payload.parsedPayload ? JSON.stringify(payload.parsedPayload) : null,
            ]);
            return (result.rowCount ?? 0) > 0;
        }
        const dedupResult = this.sqliteDb
            .prepare(`
          INSERT OR IGNORE INTO ingest_dedup (idempotency_key, created_at)
          VALUES (?, ?)
        `)
            .run(payload.idempotencyKey, now);
        if (dedupResult.changes === 0) {
            return false;
        }
        this.sqliteDb
            .prepare(`
          INSERT INTO raw_logs (
            site_id, agent_id, source_file, line_offset, occurred_at,
            raw_line, parsed_payload_json, idempotency_key, received_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `)
            .run(payload.siteId, payload.agentId, payload.sourceFile, payload.offset, payload.occurredAt, payload.rawLine, payload.parsedPayload ? JSON.stringify(payload.parsedPayload) : null, payload.idempotencyKey, now);
        return true;
    }
    async getStats() {
        if (this.storageMode === 'postgres') {
            const dedup = await this.pgPool.query('SELECT COUNT(1)::text AS count FROM ingest_dedup');
            const raw = await this.pgPool.query('SELECT COUNT(1)::text AS count FROM raw_logs');
            return {
                dedupCount: Number(dedup.rows[0]?.count ?? 0),
                rawLogCount: Number(raw.rows[0]?.count ?? 0),
            };
        }
        const dedupCountRow = this.sqliteDb
            .prepare('SELECT COUNT(1) AS count FROM ingest_dedup')
            .get();
        const rawLogCountRow = this.sqliteDb
            .prepare('SELECT COUNT(1) AS count FROM raw_logs')
            .get();
        return {
            dedupCount: dedupCountRow.count,
            rawLogCount: rawLogCountRow.count,
        };
    }
    validateRequiredFields(payload) {
        const requiredFields = [
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
                throw new common_1.BadRequestException(`Missing required field: ${field}`);
            }
        }
        if (!Number.isFinite(payload.offset)) {
            throw new common_1.BadRequestException('offset must be a valid number');
        }
    }
    validateAuth(payload, apiKeyHeader) {
        const expectedApiKey = process.env.AGENT_API_KEY;
        if (!expectedApiKey) {
            throw new common_1.UnauthorizedException('AGENT_API_KEY is not configured on server');
        }
        if (apiKeyHeader !== expectedApiKey) {
            throw new common_1.UnauthorizedException('Invalid API key');
        }
        const allowedAgentId = process.env.ALLOWED_AGENT_ID;
        if (allowedAgentId && payload.agentId !== allowedAgentId) {
            throw new common_1.UnauthorizedException('This agent is not allowed');
        }
        const hmacSecret = process.env.AGENT_HMAC_SECRET;
        if (!hmacSecret) {
            throw new common_1.UnauthorizedException('AGENT_HMAC_SECRET is not configured on server');
        }
        const base = `${payload.idempotencyKey}:${payload.occurredAt}:${payload.rawLine}`;
        const expectedSignature = (0, crypto_1.createHmac)('sha256', hmacSecret).update(base).digest('hex');
        const expected = Buffer.from(expectedSignature, 'utf8');
        const provided = Buffer.from(payload.signature, 'utf8');
        if (expected.length !== provided.length || !(0, crypto_1.timingSafeEqual)(expected, provided)) {
            throw new common_1.UnauthorizedException('Invalid signature');
        }
    }
};
exports.AppService = AppService;
exports.AppService = AppService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [])
], AppService);
//# sourceMappingURL=app.service.js.map