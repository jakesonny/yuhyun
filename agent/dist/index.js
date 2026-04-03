"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const axios_1 = __importDefault(require("axios"));
const better_sqlite3_1 = __importDefault(require("better-sqlite3"));
const crypto_1 = require("crypto");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
/** pkg 로 만든 exe 는 better-sqlite3 네이티브가 스냅샷에 없음 → exe 옆 better_sqlite3.node 사용 */
function resolveBetterSqliteNativeBinding() {
    const besideExe = path_1.default.join(path_1.default.dirname(process.execPath), 'better_sqlite3.node');
    const cwd = path_1.default.join(process.cwd(), 'better_sqlite3.node');
    for (const p of [besideExe, cwd]) {
        if (fs_1.default.existsSync(p)) {
            return path_1.default.resolve(p);
        }
    }
    return undefined;
}
const config = {
    defaultWatchDirs: parseWatchDirsFromEnv(),
    defaultIncludeFiles: parseIncludeFilesFromEnv(),
    settingsPath: path_1.default.resolve(process.env.AGENT_SETTINGS_PATH ?? path_1.default.resolve(process.cwd(), 'settings.json')),
    fileExtension: process.env.AGENT_FILE_EXTENSION ?? '.txt',
    dbPath: process.env.AGENT_DB_PATH ?? path_1.default.resolve(process.cwd(), 'agent-queue.db'),
    healthFilePath: process.env.AGENT_HEALTH_FILE_PATH ?? path_1.default.resolve(process.cwd(), 'agent-health.json'),
    defaultApiUrl: process.env.BACKEND_INGEST_URL ?? '',
    defaultApiKey: process.env.AGENT_API_KEY ?? '',
    defaultHmacSecret: process.env.AGENT_HMAC_SECRET ?? '',
    defaultSiteId: process.env.AGENT_SITE_ID ?? 'site-001',
    defaultAgentId: process.env.AGENT_ID ?? 'field-pc-001',
    scanIntervalMs: Number(process.env.AGENT_SCAN_INTERVAL_MS ?? '2000'),
    sendIntervalMs: Number(process.env.AGENT_SEND_INTERVAL_MS ?? '2000'),
    sendBatchSize: Number(process.env.AGENT_SEND_BATCH_SIZE ?? '100'),
    maxBackoffMs: Number(process.env.AGENT_MAX_BACKOFF_MS ?? `${5 * 60 * 1000}`),
};
const nativeBinding = resolveBetterSqliteNativeBinding();
const db = nativeBinding
    ? new better_sqlite3_1.default(config.dbPath, { nativeBinding })
    : new better_sqlite3_1.default(config.dbPath);
const remainderByFile = new Map();
let lastFlushAt = null;
let lastFlushSuccessAt = null;
let lastFlushError = null;
let activeWatchDirs = [];
let activeIncludeFiles = [];
let activeFileExtension = config.fileExtension;
let settingsMtimeMs = -1;
let settingsSource = 'env';
let activeApiUrl = '';
let activeApiKey = '';
let activeHmacSecret = '';
let activeSiteId = config.defaultSiteId;
let activeAgentId = config.defaultAgentId;
initDb();
reloadTrackingTargets();
validateRuntimeConfigOrExit();
printTrackingTargets();
setInterval(() => {
    try {
        reloadTrackingTargets();
        scanAllTxtFiles();
    }
    catch (err) {
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
function parseWatchDirsFromEnv() {
    const multiple = process.env.AGENT_WATCH_DIRS;
    if (multiple && multiple.trim()) {
        return multiple
            .split(',')
            .map((dir) => dir.trim())
            .filter((dir) => dir.length > 0)
            .map((dir) => path_1.default.resolve(dir));
    }
    const single = process.env.AGENT_WATCH_DIR ?? path_1.default.resolve(process.cwd(), 'sample-data');
    return [path_1.default.resolve(single)];
}
function parseIncludeFilesFromEnv() {
    const include = process.env.AGENT_INCLUDE_FILES;
    if (!include || !include.trim()) {
        return [];
    }
    return include
        .split(',')
        .map((file) => file.trim())
        .filter((file) => file.length > 0)
        .map((file) => path_1.default.resolve(file));
}
function ensureWatchDirs(watchDirs) {
    for (const watchDir of watchDirs) {
        if (!fs_1.default.existsSync(watchDir)) {
            fs_1.default.mkdirSync(watchDir, { recursive: true });
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
    for (const watchDir of activeWatchDirs) {
        const files = fs_1.default
            .readdirSync(watchDir)
            .filter((entry) => entry.endsWith(activeFileExtension))
            .map((entry) => path_1.default.join(watchDir, entry));
        for (const file of files) {
            scanFile(file);
        }
    }
}
function resolveExplicitFiles() {
    if (activeIncludeFiles.length === 0) {
        return [];
    }
    const files = activeIncludeFiles.filter((filePath) => {
        if (!filePath.endsWith(activeFileExtension)) {
            return false;
        }
        if (!fs_1.default.existsSync(filePath)) {
            return false;
        }
        return fs_1.default.statSync(filePath).isFile();
    });
    return Array.from(new Set(files));
}
function reloadTrackingTargets() {
    const loaded = loadTargetsFromSettings();
    if (loaded) {
        activeWatchDirs = loaded.watchDirs;
        activeIncludeFiles = loaded.includeFiles;
        activeFileExtension = loaded.fileExtension;
        activeApiUrl = loaded.apiUrl;
        activeApiKey = loaded.apiKey;
        activeHmacSecret = loaded.hmacSecret;
        activeSiteId = loaded.siteId;
        activeAgentId = loaded.agentId;
        settingsSource = 'settings';
    }
    else {
        activeWatchDirs = config.defaultWatchDirs;
        activeIncludeFiles = config.defaultIncludeFiles;
        activeFileExtension = config.fileExtension;
        activeApiUrl = config.defaultApiUrl;
        activeApiKey = config.defaultApiKey;
        activeHmacSecret = config.defaultHmacSecret;
        activeSiteId = config.defaultSiteId;
        activeAgentId = config.defaultAgentId;
        settingsSource = 'env';
    }
    ensureWatchDirs(activeWatchDirs);
}
function loadTargetsFromSettings() {
    if (!fs_1.default.existsSync(config.settingsPath)) {
        return null;
    }
    const stat = fs_1.default.statSync(config.settingsPath);
    if (stat.mtimeMs === settingsMtimeMs && (activeWatchDirs.length > 0 || activeIncludeFiles.length > 0)) {
        return {
            watchDirs: activeWatchDirs,
            includeFiles: activeIncludeFiles,
            fileExtension: activeFileExtension,
            apiUrl: activeApiUrl,
            apiKey: activeApiKey,
            hmacSecret: activeHmacSecret,
            siteId: activeSiteId,
            agentId: activeAgentId,
        };
    }
    settingsMtimeMs = stat.mtimeMs;
    try {
        const raw = fs_1.default.readFileSync(config.settingsPath, 'utf8');
        const parsed = JSON.parse(raw);
        const fileExtension = normalizeFileExtension(parsed.fileExtension ?? config.fileExtension);
        const watchDirs = (parsed.watchDirs ?? [])
            .map((p) => p.trim())
            .filter((p) => p.length > 0)
            .map((p) => path_1.default.resolve(p));
        const includeFiles = (parsed.includeFiles ?? [])
            .map((p) => p.trim())
            .filter((p) => p.length > 0)
            .map((p) => path_1.default.resolve(p));
        const apiUrl = (parsed.backend?.apiUrl ?? '').trim();
        const apiKey = (parsed.backend?.apiKey ?? '').trim();
        const hmacSecret = (parsed.backend?.hmacSecret ?? '').trim();
        const siteId = (parsed.identity?.siteId ?? config.defaultSiteId).trim() || config.defaultSiteId;
        const agentId = (parsed.identity?.agentId ?? config.defaultAgentId).trim() || config.defaultAgentId;
        return {
            watchDirs: watchDirs.length > 0 ? watchDirs : config.defaultWatchDirs,
            includeFiles,
            fileExtension,
            apiUrl,
            apiKey,
            hmacSecret,
            siteId,
            agentId,
        };
    }
    catch (err) {
        console.error('[agent] invalid settings.json, fallback env', err);
        return null;
    }
}
function normalizeFileExtension(value) {
    if (!value.trim()) {
        return '.txt';
    }
    return value.startsWith('.') ? value : `.${value}`;
}
function printTrackingTargets() {
    console.log(`[agent] started. settingsSource=${settingsSource}, settingsPath=${config.settingsPath}, watchDirs=${activeWatchDirs.join(', ')}`);
    console.log(`[agent] apiUrl=${activeApiUrl || '(empty)'}, agentId=${activeAgentId}, siteId=${activeSiteId}`);
    if (activeIncludeFiles.length > 0) {
        console.log(`[agent] includeFiles=${activeIncludeFiles.join(', ')}`);
    }
}
function validateRuntimeConfigOrExit() {
    const missing = [];
    if (!activeApiUrl) {
        missing.push('backend.apiUrl (or BACKEND_INGEST_URL)');
    }
    if (!activeApiKey) {
        missing.push('backend.apiKey (or AGENT_API_KEY)');
    }
    if (!activeHmacSecret) {
        missing.push('backend.hmacSecret (or AGENT_HMAC_SECRET)');
    }
    if (missing.length > 0) {
        console.error(`[agent] missing required settings: ${missing.join(', ')}`);
        process.exit(1);
    }
}
function scanFile(filePath) {
    const stat = fs_1.default.statSync(filePath);
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
    const fd = fs_1.default.openSync(filePath, 'r');
    try {
        const readBuffer = Buffer.alloc(bytesToRead);
        fs_1.default.readSync(fd, readBuffer, 0, bytesToRead, offset);
        const previousRemainder = remainderByFile.get(filePath) ?? Buffer.alloc(0);
        const combined = Buffer.concat([previousRemainder, readBuffer]);
        const baseOffset = offset - previousRemainder.length;
        const { lines, remainder } = splitLines(combined, baseOffset);
        remainderByFile.set(filePath, remainder);
        for (const line of lines) {
            enqueueLine(filePath, line.text, line.offset);
        }
    }
    finally {
        fs_1.default.closeSync(fd);
    }
    setStoredOffset(filePath, stat.size);
}
function splitLines(buffer, baseOffset) {
    const lines = [];
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
function enqueueLine(sourceFile, rawLine, offset) {
    const trimmed = rawLine.trim();
    if (!trimmed) {
        return;
    }
    const occurredAt = new Date().toISOString();
    const idempotencyKey = (0, crypto_1.createHash)('sha256')
        .update(`${sourceFile}:${offset}:${rawLine}`)
        .digest('hex');
    const signatureBase = `${idempotencyKey}:${occurredAt}:${rawLine}`;
    const signature = (0, crypto_1.createHmac)('sha256', activeHmacSecret).update(signatureBase).digest('hex');
    const payload = {
        siteId: activeSiteId,
        agentId: activeAgentId,
        sourceFile,
        offset,
        occurredAt,
        rawLine,
        parsedPayload: parseRawLine(trimmed),
        idempotencyKey,
        signature,
    };
    db.prepare(`
      INSERT OR IGNORE INTO event_queue (idempotency_key, payload_json, created_at)
      VALUES (?, ?, ?)
    `).run(idempotencyKey, JSON.stringify(payload), Date.now());
}
function parseRawLine(rawLine) {
    // 1) JSON line
    if (rawLine.startsWith('{') && rawLine.endsWith('}')) {
        try {
            const parsed = JSON.parse(rawLine);
            return { format: 'json', ...parsed };
        }
        catch {
            // fallthrough
        }
    }
    // 2) key=value,key2=value2 pattern
    if (rawLine.includes('=')) {
        const result = { format: 'kv' };
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
function normalizeValue(value) {
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
        .prepare(`
      SELECT id, idempotency_key, payload_json, retry_count
      FROM event_queue
      WHERE next_retry_at <= ?
      ORDER BY id ASC
      LIMIT ?
    `)
        .all(now, config.sendBatchSize);
    for (const row of rows) {
        const payload = JSON.parse(row.payload_json);
        try {
            const response = await axios_1.default.post(activeApiUrl, payload, {
                timeout: 10000,
                headers: {
                    'content-type': 'application/json',
                    'x-api-key': activeApiKey,
                },
            });
            if (response.status >= 200 && response.status < 300) {
                db.prepare('DELETE FROM event_queue WHERE id = ?').run(row.id);
                lastFlushSuccessAt = new Date().toISOString();
                lastFlushError = null;
                continue;
            }
            scheduleRetry(row.id, row.retry_count);
        }
        catch {
            lastFlushError = `send failed for id=${row.id} at ${new Date().toISOString()}`;
            scheduleRetry(row.id, row.retry_count);
        }
    }
}
function scheduleRetry(id, retryCount) {
    const nextRetryCount = retryCount + 1;
    const backoffMs = Math.min(2 ** Math.min(nextRetryCount, 8) * 1000, config.maxBackoffMs);
    db.prepare(`
      UPDATE event_queue
      SET retry_count = ?, next_retry_at = ?
      WHERE id = ?
    `).run(nextRetryCount, Date.now() + backoffMs, id);
}
function getStoredOffset(filePath) {
    const row = db
        .prepare('SELECT offset FROM file_offsets WHERE file_path = ?')
        .get(filePath);
    return row?.offset ?? 0;
}
function setStoredOffset(filePath, offset) {
    db.prepare(`
      INSERT INTO file_offsets (file_path, offset)
      VALUES (?, ?)
      ON CONFLICT(file_path) DO UPDATE SET offset = excluded.offset
    `).run(filePath, offset);
}
function writeHealthFile() {
    const queueCountRow = db
        .prepare('SELECT COUNT(1) as count FROM event_queue')
        .get();
    const offsetCountRow = db
        .prepare('SELECT COUNT(1) as count FROM file_offsets')
        .get();
    const now = new Date().toISOString();
    const health = {
        ok: true,
        service: 'agent',
        timestamp: now,
        siteId: activeSiteId,
        agentId: activeAgentId,
        apiUrl: activeApiUrl,
        settingsSource,
        settingsPath: config.settingsPath,
        watchDirs: activeWatchDirs,
        includeFiles: activeIncludeFiles,
        fileExtension: activeFileExtension,
        queueCount: queueCountRow.count,
        trackedFileCount: offsetCountRow.count,
        lastFlushAt,
        lastFlushSuccessAt,
        lastFlushError,
    };
    fs_1.default.writeFileSync(config.healthFilePath, JSON.stringify(health, null, 2), 'utf8');
}
