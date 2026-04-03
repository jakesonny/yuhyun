/**
 * pkg(node18-win-x64, ABI 108)용 better-sqlite3 네이티브 바이너리를 받아 agent/better_sqlite3.node 로 둡니다.
 * exe와 같은 폴더에 복사하면 런타임에서 로드합니다.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execFileSync } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const agentDir = path.resolve(__dirname, '..');
const pkg = JSON.parse(fs.readFileSync(path.join(agentDir, 'node_modules', 'better-sqlite3', 'package.json'), 'utf8'));
const version = String(pkg.version ?? '').replace(/^v/i, '');
if (!version) {
  console.error('[fetch-better-sqlite-win] better-sqlite3 package.json 버전을 읽을 수 없습니다. npm install 을 먼저 실행하세요.');
  process.exit(1);
}

/** pkg 가 쓰는 Node 18 = module ABI 108 */
const ABI = '108';
const url = `https://github.com/WiseLibs/better-sqlite3/releases/download/v${version}/better-sqlite3-v${version}-node-v${ABI}-win32-x64.tar.gz`;
const outFile = path.join(agentDir, 'better_sqlite3.node');
const tmp = path.join(agentDir, '.better-sqlite-win.tgz');

console.log('[fetch-better-sqlite-win]', url);
execFileSync('curl', ['-fsSL', '-o', tmp, url], { stdio: 'inherit' });
const nodeBuf = execFileSync('tar', ['xOf', tmp, 'build/Release/better_sqlite3.node'], {
  maxBuffer: 20 * 1024 * 1024,
});
fs.writeFileSync(outFile, nodeBuf);
fs.unlinkSync(tmp);
console.log('[fetch-better-sqlite-win] wrote', outFile);
