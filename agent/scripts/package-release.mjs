/**
 * 모노레포 루트의 release/ 폴더에 Windows 배포 묶음을 만듭니다.
 * 사용 전: agent 에서 npm run build:agents:exe (agent.exe, agent-config.exe 생성)
 * nssm.exe 는 release/ 또는 agent/ 루트에 두면 함께 복사됩니다.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const agentDir = path.resolve(__dirname, '..');
const repoRoot = path.resolve(agentDir, '..');
const releaseDir = path.join(repoRoot, 'release');

function rmrf(dir) {
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

function copyFile(src, dest) {
  if (!fs.existsSync(src)) {
    return false;
  }
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
  return true;
}

function copyDirFiles(srcDir, destDir, names) {
  fs.mkdirSync(destDir, { recursive: true });
  for (const name of names) {
    const s = path.join(srcDir, name);
    const d = path.join(destDir, name);
    if (fs.existsSync(s)) {
      fs.copyFileSync(s, d);
    }
  }
}

rmrf(releaseDir);
fs.mkdirSync(releaseDir, { recursive: true });

const scriptsDest = path.join(releaseDir, 'scripts');
copyDirFiles(path.join(agentDir, 'scripts'), scriptsDest, [
  'install-service.bat',
  'uninstall-service.bat',
  'install-service.ps1',
  'uninstall-service.ps1',
]);

const copies = [
  [path.join(agentDir, 'INSTALL_GUIDE.md'), path.join(releaseDir, 'INSTALL_GUIDE.md')],
  [path.join(agentDir, 'settings.example.json'), path.join(releaseDir, 'settings.example.json')],
  [path.join(agentDir, 'dist', 'agent.exe'), path.join(releaseDir, 'agent.exe')],
  [path.join(agentDir, 'dist', 'agent-config.exe'), path.join(releaseDir, 'agent-config.exe')],
];

const notes = [];

for (const [from, to] of copies) {
  const ok = copyFile(from, to);
  const base = path.basename(from);
  if (!ok) {
    if (base === 'agent.exe' || base === 'agent-config.exe') {
      notes.push(`${base} 없음 — agent 폴더에서 npm run build:agents:exe 실행 후 npm run release:pack 을 다시 실행하세요.`);
    } else {
      notes.push(`복사 실패: ${base}`);
    }
  }
}

const nssmSources = [
  path.join(agentDir, 'nssm.exe'),
  path.join(agentDir, 'tools', 'nssm.exe'),
  path.join(repoRoot, 'tools', 'nssm.exe'),
];
let nssmOk = false;
for (const p of nssmSources) {
  if (fs.existsSync(p)) {
    copyFile(p, path.join(releaseDir, 'nssm.exe'));
    nssmOk = true;
    break;
  }
}

if (!nssmOk) {
  const nssmNote = path.join(releaseDir, 'NSSM-안내.txt');
  fs.writeFileSync(
    nssmNote,
    [
      'nssm.exe 가 이 폴더에 없습니다.',
      'https://nssm.cc/download 에서 받은 nssm.exe 를 이 폴더(INSTALL_GUIDE와 같은 위치)에 넣은 뒤 install-service.bat 을 실행하세요.',
      '',
    ].join('\r\n'),
    'utf8',
  );
  notes.push('nssm.exe 없음 — NSSM-안내.txt 참고 후 수동으로 넣으세요.');
}

const readme = path.join(releaseDir, '배포-V2-안내.txt');
fs.writeFileSync(
  readme,
  [
    '유현건설 계측 에이전트 배포 묶음 (v2)',
    '',
    '포함:',
    '  agent.exe          수집 에이전트',
    '  agent-config.exe   설정 (API 키·HMAC·폴더)',
    '  nssm.exe           Windows 서비스 등록용 (있을 때)',
    '  scripts/           서비스 설치·제거',
    '  INSTALL_GUIDE.md   설치 절차',
    '  settings.example.json  설정 파일 예시',
    '',
    '압축: 이 release 폴더 전체를 zip 으로 묶어 배포하면 됩니다.',
    '',
    ...notes.map((n) => `[확인] ${n}`),
    notes.length ? '' : '[확인] 필수 파일이 모두 복사된 것으로 보입니다.',
    '',
  ].join('\r\n'),
  'utf8',
);

console.log('[package-release] 출력:', releaseDir);
for (const n of notes) {
  console.warn('  ⚠', n);
}
if (!notes.length) {
  console.log('  완료. release 폴더를 zip 으로 묶으세요.');
}
