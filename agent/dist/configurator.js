"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const child_process_1 = require("child_process");
const settingsPath = path_1.default.resolve(process.env.AGENT_SETTINGS_PATH ?? path_1.default.resolve(process.cwd(), 'settings.json'));
const settings = loadSettings();
if (process.platform !== 'win32') {
    console.error('[agent-config] This configurator is supported on Windows only.');
    process.exit(1);
}
const apiUrl = askTextDialog('백엔드 설정', '백엔드 Ingest URL을 입력하세요 (예: https://xxxx.onrender.com/api/ingest)', settings.backend.apiUrl);
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
showInfoDialog('설정 저장 완료', `settings.json 저장 완료\n\n경로: ${settingsPath}\n추적 폴더 수: ${settings.watchDirs.length}`);
function loadSettings() {
    const fallback = {
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
    if (!fs_1.default.existsSync(settingsPath)) {
        return fallback;
    }
    try {
        const raw = fs_1.default.readFileSync(settingsPath, 'utf8');
        const parsed = JSON.parse(raw);
        return {
            watchDirs: Array.isArray(parsed.watchDirs) ? parsed.watchDirs.map((v) => String(v)) : [],
            includeFiles: Array.isArray(parsed.includeFiles) ? parsed.includeFiles.map((v) => String(v)) : [],
            fileExtension: typeof parsed.fileExtension === 'string' && parsed.fileExtension.trim()
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
    }
    catch {
        return fallback;
    }
}
function saveSettings(next) {
    const dir = path_1.default.dirname(settingsPath);
    if (!fs_1.default.existsSync(dir)) {
        fs_1.default.mkdirSync(dir, { recursive: true });
    }
    fs_1.default.writeFileSync(settingsPath, `${JSON.stringify(next, null, 2)}\n`, 'utf8');
}
function addUnique(list, value) {
    const normalized = path_1.default.resolve(value);
    if (!list.includes(normalized)) {
        list.push(normalized);
    }
}
function runFolderMenu(next) {
    while (true) {
        const action = askTextDialog('폴더 설정 메뉴', '작업을 입력하세요: A(추가), L(목록), R(삭제), S(저장 후 종료)', 'A');
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
            showInfoDialog('폴더 추가', `추가됨:\n${path_1.default.resolve(selectedFolder)}`);
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
function showFolderList(list) {
    if (list.length === 0) {
        showInfoDialog('등록 폴더 목록', '등록된 폴더가 없습니다.');
        return;
    }
    const lines = list.map((item, idx) => `${idx + 1}. ${item}`).join('\n');
    showInfoDialog('등록 폴더 목록', lines);
}
function removeFolderFromList(list) {
    if (list.length === 0) {
        showInfoDialog('폴더 삭제', '삭제할 폴더가 없습니다.');
        return;
    }
    const lines = list.map((item, idx) => `${idx + 1}. ${item}`).join('\n');
    const selectedIndexRaw = askTextDialog('폴더 삭제', `삭제할 번호를 입력하세요.\n\n${lines}`, '1');
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
function pickFolderDialog() {
    const script = [
        'Add-Type -AssemblyName System.Windows.Forms',
        '$dialog = New-Object System.Windows.Forms.FolderBrowserDialog',
        '$dialog.Description = "추적할 TXT 폴더를 선택하세요"',
        '$dialog.ShowNewFolderButton = $true',
        '$result = $dialog.ShowDialog()',
        'if ($result -eq [System.Windows.Forms.DialogResult]::OK) { [Console]::Write($dialog.SelectedPath) }',
    ].join('; ');
    const result = (0, child_process_1.spawnSync)('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', script], { encoding: 'utf8' });
    if (result.status !== 0) {
        return null;
    }
    const output = (result.stdout ?? '').trim();
    return output || null;
}
function askYesNoDialog(title, message) {
    const escapedMessage = message.replace(/'/g, "''");
    const escapedTitle = title.replace(/'/g, "''");
    const script = [
        'Add-Type -AssemblyName PresentationFramework',
        `$res = [System.Windows.MessageBox]::Show('${escapedMessage}','${escapedTitle}','YesNo','Question')`,
        'if ($res -eq [System.Windows.MessageBoxResult]::Yes) { [Console]::Write("YES") } else { [Console]::Write("NO") }',
    ].join('; ');
    const result = (0, child_process_1.spawnSync)('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', script], { encoding: 'utf8' });
    return (result.stdout ?? '').trim() === 'YES';
}
function askTextDialog(title, message, defaultValue = '') {
    const escapedMessage = message.replace(/'/g, "''");
    const escapedTitle = title.replace(/'/g, "''");
    const escapedDefault = defaultValue.replace(/'/g, "''");
    const script = [
        'Add-Type -AssemblyName Microsoft.VisualBasic',
        `$value = [Microsoft.VisualBasic.Interaction]::InputBox('${escapedMessage}','${escapedTitle}','${escapedDefault}')`,
        '[Console]::Write($value)',
    ].join('; ');
    const result = (0, child_process_1.spawnSync)('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', script], { encoding: 'utf8' });
    if (result.status !== 0) {
        return null;
    }
    return (result.stdout ?? '').trim();
}
function showInfoDialog(title, message) {
    const escapedMessage = message.replace(/'/g, "''");
    const escapedTitle = title.replace(/'/g, "''");
    const script = [
        'Add-Type -AssemblyName PresentationFramework',
        `[System.Windows.MessageBox]::Show('${escapedMessage}','${escapedTitle}','OK','Information') | Out-Null`,
    ].join('; ');
    (0, child_process_1.spawnSync)('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', script], {
        encoding: 'utf8',
    });
}
