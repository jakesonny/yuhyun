# Agent 운영 가이드

- 현장 설치용 빠른 문서: `INSTALL_GUIDE.md`

## 1) 개발 실행

```bash
npm install
cp .env.example .env
npm run dev
```

### 추적 폴더 설정

- 권장 방식: `agent-config.exe`로 폴더를 선택해서 설정 저장
  - 실행: `dist/agent-config.exe` (또는 `scripts/run-config.bat`)
  - 백엔드 URL/API Key/HMAC Secret/Site ID/Agent ID도 함께 입력
  - 선택한 폴더가 `settings.json`의 `watchDirs`에 누적 저장됨
  - 등록 폴더 목록 보기/삭제 가능
  - 에이전트는 실행 중 `settings.json` 변경을 자동 반영
- 수동 편집이 필요하면 `settings.example.json`을 `settings.json`으로 복사 후 수정 가능
- 단일 폴더: `AGENT_WATCH_DIR=./sample-data`
- 다중 폴더: `AGENT_WATCH_DIRS=./sample-data,./sample-data-2`
- 특정 파일만 추적: `AGENT_INCLUDE_FILES=E:\measure\A.txt,E:\measure\B.txt`
- 우선순위: `settings.json` > `AGENT_INCLUDE_FILES` > `AGENT_WATCH_DIRS` > `AGENT_WATCH_DIR`
- 헬스 파일: `AGENT_HEALTH_FILE_PATH=./agent-health.json` (큐 적재량, 마지막 전송 시간, 에러 상태 확인)

## 2) exe 빌드

```bash
npm run build:exe
npm run build:config:exe
```

생성 결과:

- `dist/agent.exe`
- `dist/agent-config.exe`

## 3) Windows 서비스 설치 (nssm 사용)

사전 준비(최소):

- `nssm.exe`를 `agent` 폴더(또는 `agent/tools`)에 복사
- `dist/agent.exe` 빌드 완료

가장 간단한 설치 방법(관리자 권한으로 실행):

```bat
scripts\install-service.bat
```

서비스 제거(관리자 권한):

```bat
scripts\uninstall-service.bat
```

참고:

- 스크립트가 자동으로 `nssm.exe` 경로를 탐색합니다.
- 설치 시 서비스 자동 시작 및 장애 자동 재시작 정책을 함께 설정합니다.
