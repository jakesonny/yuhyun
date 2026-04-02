import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';

type AgentSettings = {
  watchDirs: string[];
  includeFiles: string[];
  fileExtension: string;
  backend: {
    apiUrl: string;
    apiKey: string;
    hmacSecret: string;
  };
  identity: {
    siteId: string;
    agentId: string;
  };
};

const settingsPath = path.resolve(process.env.AGENT_SETTINGS_PATH ?? path.resolve(process.cwd(), 'settings.json'));
const settings = loadSettings();

if (process.platform !== 'win32') {
  console.error('[agent-config] This configurator is supported on Windows only.');
  process.exit(1);
}

const apiUrl = askTextDialog(
  '백엔드 설정',
  '백엔드 Ingest URL을 입력하세요 (예: https://xxxx.onrender.com/api/ingest)',
  settings.backend.apiUrl,
);
if (!apiUrl) {
  showInfoDialog('설정 취소', '백엔드 URL이 비어 있어 설정을 종료합니다.');
  process.exit(1);
}
settings.backend.apiUrl = apiUrl.trim();

const apiKey = askTextDialog('백엔드 설정', 'Agent API Key를 입력하세요', settings.backend.apiKey);
if (!apiKey) {
  showInfoDialog('설정 취소', 'API Key가 비어 있어 설정을 종료합니다.');
  process.exit(1);
}
settings.backend.apiKey = apiKey.trim();

const hmacSecret = askTextDialog('백엔드 설정', 'HMAC Secret을 입력하세요', settings.backend.hmacSecret);
if (!hmacSecret) {
  showInfoDialog('설정 취소', 'HMAC Secret이 비어 있어 설정을 종료합니다.');
  process.exit(1);
}
settings.backend.hmacSecret = hmacSecret.trim();

const siteId = askTextDialog('식별자 설정', 'Site ID를 입력하세요', settings.identity.siteId);
if (siteId && siteId.trim()) {
  settings.identity.siteId = siteId.trim();
}

const agentId = askTextDialog('식별자 설정', 'Agent ID를 입력하세요', settings.identity.agentId);
if (agentId && agentId.trim()) {
  settings.identity.agentId = agentId.trim();
}

runFolderMenu(settings);

saveSettings(settings);
showInfoDialog(
  '설정 저장 완료',
  `settings.json 저장 완료\n\n경로: ${settingsPath}\n추적 폴더 수: ${settings.watchDirs.length}`,
);

function loadSettings(): AgentSettings {
  const fallback: AgentSettings = {
    watchDirs: [],
    includeFiles: [],
    fileExtension: '.txt',
    backend: {
      apiUrl: '',
      apiKey: '',
      hmacSecret: '',
    },
    identity: {
      siteId: 'site-001',
      agentId: 'field-pc-001',
    },
  };

  if (!fs.existsSync(settingsPath)) {
    return fallback;
  }

  try {
    const raw = fs.readFileSync(settingsPath, 'utf8');
    const parsed = JSON.parse(raw) as Partial<AgentSettings>;
    return {
      watchDirs: Array.isArray(parsed.watchDirs) ? parsed.watchDirs.map((v) => String(v)) : [],
      includeFiles: Array.isArray(parsed.includeFiles) ? parsed.includeFiles.map((v) => String(v)) : [],
      fileExtension:
        typeof parsed.fileExtension === 'string' && parsed.fileExtension.trim()
          ? parsed.fileExtension
          : '.txt',
      backend: {
        apiUrl: String(parsed.backend?.apiUrl ?? ''),
        apiKey: String(parsed.backend?.apiKey ?? ''),
        hmacSecret: String(parsed.backend?.hmacSecret ?? ''),
      },
      identity: {
        siteId: String(parsed.identity?.siteId ?? 'site-001'),
        agentId: String(parsed.identity?.agentId ?? 'field-pc-001'),
      },
    };
  } catch {
    return fallback;
  }
}

function saveSettings(next: AgentSettings) {
  const dir = path.dirname(settingsPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(settingsPath, `${JSON.stringify(next, null, 2)}\n`, 'utf8');
}

function addUnique(list: string[], value: string) {
  const normalized = path.resolve(value);
  if (!list.includes(normalized)) {
    list.push(normalized);
  }
}

function runFolderMenu(next: AgentSettings) {
  while (true) {
    const action = askTextDialog(
      '폴더 설정 메뉴',
      '작업을 입력하세요: A(추가), L(목록), R(삭제), S(저장 후 종료)',
      'A',
    );

    const command = (action ?? '').trim().toUpperCase();
    if (!command) {
      continue;
    }

    if (command === 'A') {
      const selectedFolder = pickFolderDialog();
      if (!selectedFolder) {
        showInfoDialog('폴더 추가', '폴더 선택이 취소되었습니다.');
        continue;
      }
      addUnique(next.watchDirs, selectedFolder);
      showInfoDialog('폴더 추가', `추가됨:\n${path.resolve(selectedFolder)}`);
      continue;
    }

    if (command === 'L') {
      showFolderList(next.watchDirs);
      continue;
    }

    if (command === 'R') {
      removeFolderFromList(next.watchDirs);
      continue;
    }

    if (command === 'S') {
      return;
    }

    showInfoDialog('입력 오류', 'A, L, R, S 중 하나를 입력해주세요.');
  }
}

function showFolderList(list: string[]) {
  if (list.length === 0) {
    showInfoDialog('등록 폴더 목록', '등록된 폴더가 없습니다.');
    return;
  }

  const lines = list.map((item, idx) => `${idx + 1}. ${item}`).join('\n');
  showInfoDialog('등록 폴더 목록', lines);
}

function removeFolderFromList(list: string[]) {
  if (list.length === 0) {
    showInfoDialog('폴더 삭제', '삭제할 폴더가 없습니다.');
    return;
  }

  const lines = list.map((item, idx) => `${idx + 1}. ${item}`).join('\n');
  const selectedIndexRaw = askTextDialog(
    '폴더 삭제',
    `삭제할 번호를 입력하세요.\n\n${lines}`,
    '1',
  );
  if (!selectedIndexRaw) {
    return;
  }
  const selectedIndex = Number(selectedIndexRaw);
  if (!Number.isInteger(selectedIndex) || selectedIndex < 1 || selectedIndex > list.length) {
    showInfoDialog('입력 오류', '올바른 번호를 입력해주세요.');
    return;
  }

  const removed = list.splice(selectedIndex - 1, 1)[0];
  showInfoDialog('폴더 삭제', `삭제됨:\n${removed}`);
}

function pickFolderDialog(): string | null {
  const script = [
    'Add-Type -AssemblyName System.Windows.Forms',
    '$dialog = New-Object System.Windows.Forms.FolderBrowserDialog',
    '$dialog.Description = "추적할 TXT 폴더를 선택하세요"',
    '$dialog.ShowNewFolderButton = $true',
    '$result = $dialog.ShowDialog()',
    'if ($result -eq [System.Windows.Forms.DialogResult]::OK) { [Console]::Write($dialog.SelectedPath) }',
  ].join('; ');

  const result = spawnSync(
    'powershell.exe',
    ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', script],
    { encoding: 'utf8' },
  );

  if (result.status !== 0) {
    return null;
  }
  const output = (result.stdout ?? '').trim();
  return output || null;
}

function askYesNoDialog(title: string, message: string): boolean {
  const escapedMessage = message.replace(/'/g, "''");
  const escapedTitle = title.replace(/'/g, "''");
  const script = [
    'Add-Type -AssemblyName PresentationFramework',
    `$res = [System.Windows.MessageBox]::Show('${escapedMessage}','${escapedTitle}','YesNo','Question')`,
    'if ($res -eq [System.Windows.MessageBoxResult]::Yes) { [Console]::Write("YES") } else { [Console]::Write("NO") }',
  ].join('; ');

  const result = spawnSync(
    'powershell.exe',
    ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', script],
    { encoding: 'utf8' },
  );
  return (result.stdout ?? '').trim() === 'YES';
}

function askTextDialog(title: string, message: string, defaultValue = ''): string | null {
  const escapedMessage = message.replace(/'/g, "''");
  const escapedTitle = title.replace(/'/g, "''");
  const escapedDefault = defaultValue.replace(/'/g, "''");
  const script = [
    'Add-Type -AssemblyName Microsoft.VisualBasic',
    `$value = [Microsoft.VisualBasic.Interaction]::InputBox('${escapedMessage}','${escapedTitle}','${escapedDefault}')`,
    '[Console]::Write($value)',
  ].join('; ');

  const result = spawnSync(
    'powershell.exe',
    ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', script],
    { encoding: 'utf8' },
  );

  if (result.status !== 0) {
    return null;
  }
  return (result.stdout ?? '').trim();
}

function showInfoDialog(title: string, message: string) {
  const escapedMessage = message.replace(/'/g, "''");
  const escapedTitle = title.replace(/'/g, "''");
  const script = [
    'Add-Type -AssemblyName PresentationFramework',
    `[System.Windows.MessageBox]::Show('${escapedMessage}','${escapedTitle}','OK','Information') | Out-Null`,
  ].join('; ');
  spawnSync('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', script], {
    encoding: 'utf8',
  });
}
