# Agent 운영 가이드

## 1) 개발 실행

```bash
npm install
cp .env.example .env
npm run dev
```

### 추적 폴더 설정

- 단일 폴더: `AGENT_WATCH_DIR=./sample-data`
- 다중 폴더: `AGENT_WATCH_DIRS=./sample-data,./sample-data-2`
- 특정 파일만 추적: `AGENT_INCLUDE_FILES=E:\measure\A.txt,E:\measure\B.txt`
- 우선순위: `AGENT_INCLUDE_FILES` > `AGENT_WATCH_DIRS` > `AGENT_WATCH_DIR`
- 헬스 파일: `AGENT_HEALTH_FILE_PATH=./agent-health.json` (큐 적재량, 마지막 전송 시간, 에러 상태 확인)

## 2) exe 빌드

```bash
npm run build:exe
```

생성 결과:

- `dist/agent.exe`

## 3) Windows 서비스 설치 (nssm 사용)

사전 준비:

- `nssm.exe` 설치 (예: `C:\tools\nssm\nssm.exe`)
- `.env` 파일 구성 완료
- `dist/agent.exe` 빌드 완료

PowerShell(관리자 권한):

```powershell
cd agent
.\scripts\install-service.ps1 -NssmPath "C:\tools\nssm\nssm.exe" -AgentExePath ".\dist\agent.exe" -WorkingDirectory "."
```

서비스 제거:

```powershell
.\scripts\uninstall-service.ps1 -NssmPath "C:\tools\nssm\nssm.exe"
```
