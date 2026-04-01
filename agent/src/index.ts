import 'dotenv/config';
import axios from 'axios';
import Database from 'better-sqlite3';
import { createHmac, createHash } from 'crypto';
import fs from 'fs';
import path from 'path';

type AgentEvent = {
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

const config = {
  watchDirs: parseWatchDirs(),
  includeFiles: parseIncludeFiles(),
  fileExtension: process.env.AGENT_FILE_EXTENSION ?? '.txt',
  dbPath: process.env.AGENT_DB_PATH ?? path.resolve(process.cwd(), 'agent-queue.db'),
  healthFilePath: process.env.AGENT_HEALTH_FILE_PATH ?? path.resolve(process.cwd(), 'agent-health.json'),
  apiUrl: process.env.BACKEND_INGEST_URL ?? 'http://localhost:3000/api/ingest',
  apiKey: process.env.AGENT_API_KEY ?? '',
  hmacSecret: process.env.AGENT_HMAC_SECRET ?? '',
  siteId: process.env.AGENT_SITE_ID ?? 'site-001',
  agentId: process.env.AGENT_ID ?? 'field-pc-001',
  scanIntervalMs: Number(process.env.AGENT_SCAN_INTERVAL_MS ?? '2000'),
  sendIntervalMs: Number(process.env.AGENT_SEND_INTERVAL_MS ?? '2000'),
  sendBatchSize: Number(process.env.AGENT_SEND_BATCH_SIZE ?? '100'),
  maxBackoffMs: Number(process.env.AGENT_MAX_BACKOFF_MS ?? `${5 * 60 * 1000}`),
};

if (!config.apiKey || !config.hmacSecret) {
  console.error('[agent] AGENT_API_KEY / AGENT_HMAC_SECRET are required.');
  process.exit(1);
}

const db = new Database(config.dbPath);
const remainderByFile = new Map<string, Buffer>();
let lastFlushAt: string | null = null;
let lastFlushSuccessAt: string | null = null;
let lastFlushError: string | null = null;

initDb();
ensureWatchDirs();
console.log(`[agent] started. watchDirs=${config.watchDirs.join(', ')}`);
if (config.includeFiles.length > 0) {
  console.log(`[agent] includeFiles=${config.includeFiles.join(', ')}`);
}

setInterval(() => {
  try {
    scanAllTxtFiles();
  } catch (err) {
    console.error('[agent] scan error', err);
  }
}, config.scanIntervalMs);

setInterval(() => {
  void flushQueue().catch((err) => {
    console.error('[agent] flush error', err);
  });
}, config.sendIntervalMs);

setInterval(() => {
  writeHealthFile();
}, config.sendIntervalMs);

void flushQueue();
scanAllTxtFiles();
writeHealthFile();

function initDb() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS file_offsets (
      file_path TEXT PRIMARY KEY,
      offset INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS event_queue (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      idempotency_key TEXT NOT NULL UNIQUE,
      payload_json TEXT NOT NULL,
      retry_count INTEGER NOT NULL DEFAULT 0,
      next_retry_at INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL
    );
  `);
}

function parseWatchDirs(): string[] {
  const multiple = process.env.AGENT_WATCH_DIRS;
  if (multiple && multiple.trim()) {
    return multiple
      .split(',')
      .map((dir) => dir.trim())
      .filter((dir) => dir.length > 0)
      .map((dir) => path.resolve(dir));
  }

  const single = process.env.AGENT_WATCH_DIR ?? path.resolve(process.cwd(), 'sample-data');
  return [path.resolve(single)];
}

function parseIncludeFiles(): string[] {
  const include = process.env.AGENT_INCLUDE_FILES;
  if (!include || !include.trim()) {
    return [];
  }

  return include
    .split(',')
    .map((file) => file.trim())
    .filter((file) => file.length > 0)
    .map((file) => path.resolve(file));
}

function ensureWatchDirs() {
  for (const watchDir of config.watchDirs) {
    if (!fs.existsSync(watchDir)) {
      fs.mkdirSync(watchDir, { recursive: true });
    }
  }
}

function scanAllTxtFiles() {
  const explicitFiles = resolveExplicitFiles();
  if (explicitFiles.length > 0) {
    for (const file of explicitFiles) {
      scanFile(file);
    }
    return;
  }

  for (const watchDir of config.watchDirs) {
    const files = fs
      .readdirSync(watchDir)
      .filter((entry) => entry.endsWith(config.fileExtension))
      .map((entry) => path.join(watchDir, entry));

    for (const file of files) {
      scanFile(file);
    }
  }
}

function resolveExplicitFiles(): string[] {
  if (config.includeFiles.length === 0) {
    return [];
  }

  const files = config.includeFiles.filter((filePath) => {
    if (!filePath.endsWith(config.fileExtension)) {
      return false;
    }
    if (!fs.existsSync(filePath)) {
      return false;
    }
    return fs.statSync(filePath).isFile();
  });

  return Array.from(new Set(files));
}

function scanFile(filePath: string) {
  const stat = fs.statSync(filePath);
  const storedOffset = getStoredOffset(filePath);
  let offset = storedOffset;

  if (stat.size < storedOffset) {
    // File was rotated/recreated; restart from zero.
    offset = 0;
    remainderByFile.delete(filePath);
  }

  if (stat.size === offset) {
    return;
  }

  const bytesToRead = stat.size - offset;
  const fd = fs.openSync(filePath, 'r');
  try {
    const readBuffer = Buffer.alloc(bytesToRead);
    fs.readSync(fd, readBuffer, 0, bytesToRead, offset);

    const previousRemainder = remainderByFile.get(filePath) ?? Buffer.alloc(0);
    const combined = Buffer.concat([previousRemainder, readBuffer]);
    const baseOffset = offset - previousRemainder.length;
    const { lines, remainder } = splitLines(combined, baseOffset);
    remainderByFile.set(filePath, remainder);

    for (const line of lines) {
      enqueueLine(filePath, line.text, line.offset);
    }
  } finally {
    fs.closeSync(fd);
  }

  setStoredOffset(filePath, stat.size);
}

function splitLines(
  buffer: Buffer,
  baseOffset: number,
): { lines: Array<{ text: string; offset: number }>; remainder: Buffer } {
  const lines: Array<{ text: string; offset: number }> = [];
  let start = 0;

  for (let i = 0; i < buffer.length; i += 1) {
    if (buffer[i] !== 0x0a) {
      continue;
    }

    const raw = buffer.slice(start, i);
    const normalized = raw.length > 0 && raw[raw.length - 1] === 0x0d ? raw.slice(0, -1) : raw;
    const text = normalized.toString('utf8');
    lines.push({ text, offset: baseOffset + start });
    start = i + 1;
  }

  return {
    lines,
    remainder: buffer.slice(start),
  };
}

function enqueueLine(sourceFile: string, rawLine: string, offset: number) {
  const trimmed = rawLine.trim();
  if (!trimmed) {
    return;
  }

  const occurredAt = new Date().toISOString();
  const idempotencyKey = createHash('sha256')
    .update(`${sourceFile}:${offset}:${rawLine}`)
    .digest('hex');
  const signatureBase = `${idempotencyKey}:${occurredAt}:${rawLine}`;
  const signature = createHmac('sha256', config.hmacSecret).update(signatureBase).digest('hex');

  const payload: AgentEvent = {
    siteId: config.siteId,
    agentId: config.agentId,
    sourceFile,
    offset,
    occurredAt,
    rawLine,
    parsedPayload: parseRawLine(trimmed),
    idempotencyKey,
    signature,
  };

  db.prepare(
    `
      INSERT OR IGNORE INTO event_queue (idempotency_key, payload_json, created_at)
      VALUES (?, ?, ?)
    `,
  ).run(idempotencyKey, JSON.stringify(payload), Date.now());
}

function parseRawLine(rawLine: string): Record<string, unknown> | undefined {
  // 1) JSON line
  if (rawLine.startsWith('{') && rawLine.endsWith('}')) {
    try {
      const parsed = JSON.parse(rawLine) as Record<string, unknown>;
      return { format: 'json', ...parsed };
    } catch {
      // fallthrough
    }
  }

  // 2) key=value,key2=value2 pattern
  if (rawLine.includes('=')) {
    const result: Record<string, unknown> = { format: 'kv' };
    const chunks = rawLine.split(',').map((chunk) => chunk.trim());
    let validPairCount = 0;
    for (const chunk of chunks) {
      const idx = chunk.indexOf('=');
      if (idx <= 0) {
        continue;
      }
      const key = chunk.slice(0, idx).trim();
      const value = chunk.slice(idx + 1).trim();
      if (!key) {
        continue;
      }
      result[key] = normalizeValue(value);
      validPairCount += 1;
    }
    if (validPairCount > 0) {
      return result;
    }
  }

  // 3) CSV basic: sensorId,value[,unit]
  if (rawLine.includes(',')) {
    const items = rawLine.split(',').map((item) => item.trim());
    if (items.length >= 2) {
      const [sensorId, value, unit, ...rest] = items;
      return {
        format: 'csv',
        sensorId,
        value: normalizeValue(value),
        unit: unit || undefined,
        extra: rest.length > 0 ? rest : undefined,
      };
    }
  }

  return undefined;
}

function normalizeValue(value: string): string | number | boolean {
  if (value === 'true') {
    return true;
  }
  if (value === 'false') {
    return false;
  }
  const asNumber = Number(value);
  if (!Number.isNaN(asNumber) && value !== '') {
    return asNumber;
  }
  return value;
}

async function flushQueue() {
  lastFlushAt = new Date().toISOString();
  const now = Date.now();
  const rows = db
    .prepare(
      `
      SELECT id, idempotency_key, payload_json, retry_count
      FROM event_queue
      WHERE next_retry_at <= ?
      ORDER BY id ASC
      LIMIT ?
    `,
    )
    .all(now, config.sendBatchSize) as Array<{
    id: number;
    idempotency_key: string;
    payload_json: string;
    retry_count: number;
  }>;

  for (const row of rows) {
    const payload = JSON.parse(row.payload_json) as AgentEvent;
    try {
      const response = await axios.post(config.apiUrl, payload, {
        timeout: 10000,
        headers: {
          'content-type': 'application/json',
          'x-api-key': config.apiKey,
        },
      });

      if (response.status >= 200 && response.status < 300) {
        db.prepare('DELETE FROM event_queue WHERE id = ?').run(row.id);
        lastFlushSuccessAt = new Date().toISOString();
        lastFlushError = null;
        continue;
      }

      scheduleRetry(row.id, row.retry_count);
    } catch {
      lastFlushError = `send failed for id=${row.id} at ${new Date().toISOString()}`;
      scheduleRetry(row.id, row.retry_count);
    }
  }
}

function scheduleRetry(id: number, retryCount: number) {
  const nextRetryCount = retryCount + 1;
  const backoffMs = Math.min(2 ** Math.min(nextRetryCount, 8) * 1000, config.maxBackoffMs);
  db.prepare(
    `
      UPDATE event_queue
      SET retry_count = ?, next_retry_at = ?
      WHERE id = ?
    `,
  ).run(nextRetryCount, Date.now() + backoffMs, id);
}

function getStoredOffset(filePath: string): number {
  const row = db
    .prepare('SELECT offset FROM file_offsets WHERE file_path = ?')
    .get(filePath) as { offset: number } | undefined;
  return row?.offset ?? 0;
}

function setStoredOffset(filePath: string, offset: number) {
  db.prepare(
    `
      INSERT INTO file_offsets (file_path, offset)
      VALUES (?, ?)
      ON CONFLICT(file_path) DO UPDATE SET offset = excluded.offset
    `,
  ).run(filePath, offset);
}

function writeHealthFile() {
  const queueCountRow = db
    .prepare('SELECT COUNT(1) as count FROM event_queue')
    .get() as { count: number };
  const offsetCountRow = db
    .prepare('SELECT COUNT(1) as count FROM file_offsets')
    .get() as { count: number };
  const now = new Date().toISOString();

  const health = {
    ok: true,
    service: 'agent',
    timestamp: now,
    siteId: config.siteId,
    agentId: config.agentId,
    apiUrl: config.apiUrl,
    watchDirs: config.watchDirs,
    includeFiles: config.includeFiles,
    queueCount: queueCountRow.count,
    trackedFileCount: offsetCountRow.count,
    lastFlushAt,
    lastFlushSuccessAt,
    lastFlushError,
  };

  fs.writeFileSync(config.healthFilePath, JSON.stringify(health, null, 2), 'utf8');
}
