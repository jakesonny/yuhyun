/**
 * NSSM Win64 v2.24.1 바이너리를 agent/nssm.exe 로 받습니다.
 * 출처: https://github.com/fawno/nssm.cc/releases/tag/v2.24.1
 * (macOS/Linux: curl + unzip 필요. Windows에서는 브라우저로 위 Release에서 Win64 zip 받아 nssm.exe만 꺼내도 됩니다.)
 */
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import { execFileSync } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const agentDir = path.resolve(__dirname, '..');
const zipUrl = 'https://github.com/fawno/nssm.cc/releases/download/v2.24.1/nssm-v2.24.1-Win64.zip';
const tmpZip = path.join(os.tmpdir(), `nssm-win64-${Date.now()}.zip`);
const outExe = path.join(agentDir, 'nssm.exe');

console.log('[fetch-nssm] downloading', zipUrl);
execFileSync('curl', ['-fsSL', '-o', tmpZip, zipUrl], { stdio: 'inherit' });
const buf = execFileSync('unzip', ['-p', tmpZip, 'nssm.exe'], {
  encoding: null,
  maxBuffer: 10 * 1024 * 1024,
});
fs.writeFileSync(outExe, buf);
fs.unlinkSync(tmpZip);
console.log('[fetch-nssm] wrote', outExe);
