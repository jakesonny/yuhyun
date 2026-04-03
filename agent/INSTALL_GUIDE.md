# 현장 PC 설치 가이드 (Windows 11)

## 0) 준비 파일

- `agent.exe`
- `agent-config.exe`
- `scripts/install-service.bat`
- `scripts/uninstall-service.bat`
- `nssm.exe` (저장소 `agent/nssm.exe`에 동봉 — Win64 v2.24.1, [fawno/nssm.cc](https://github.com/fawno/nssm.cc/releases) 빌드)

권장 폴더:

- `C:\YuhyunAgent`

## 1) 설정 (`agent-config.exe`)

1. `agent-config.exe` 실행
2. **Agent API Key**, **HMAC Secret**, **Site ID**, **Agent ID** 입력 (이전에 저장된 값이 있으면 입력창에 기본값으로 표시됨)
3. **추적 폴더** 메뉴에서 A(추가), L(목록), R(삭제), S(저장 후 종료)
4. 저장 완료 확인

**Ingest URL**은 별도 입력 없이 `https://yuhyeon.onrender.com/api/ingest`로 저장됩니다. 다른 주소가 필요하면 `settings.json`의 `backend.apiUrl`을 수정하거나, config 실행 전에 환경변수 `BACKEND_INGEST_URL`을 설정하세요.

나머지 값은 **`settings.json`**에 저장됩니다. 형식 예시는 `settings.example.json`을 참고하세요.

## (개발) Windows exe 빌드 및 `release/` 묶음

에이전트 디렉터리에서:

```bash
npm run build:agents:exe
npm run release:pack
```

- 상위 폴더에 **`release/`** 가 생기며, zip으로 묶어 배포하면 됩니다 (`agent.exe`, `agent-config.exe`, `scripts/`, 안내 문서 등).
- `nssm.exe`는 기본적으로 `agent/nssm.exe`가 `release/`로 복사됩니다. 없을 때만 `release/NSSM-안내.txt`가 생성됩니다. 갱신이 필요하면 `npm run fetch:nssm`을 실행하세요.

개별 빌드만 할 때:

```bash
npm run build:exe
npm run build:config:exe
```

## 3) 서비스 설치

1. `install-service.bat`를 **관리자 권한**으로 실행
2. 설치 완료 메시지 확인

설치되면 부팅 시 자동 시작되고, 장애 시 자동 재시작됩니다.

## 4) 동작 확인

- 서비스 상태 확인:
  - `services.msc`에서 `YuhyunIngestAgent`가 `실행 중`인지 확인
- 에이전트 상태 파일 확인:
  - `agent-health.json`에서 `queueCount`, `lastFlushSuccessAt` 확인
- 백엔드 확인:
  - `GET /api/health`
  - `GET /api/ingest/stats`에서 카운트 증가 확인

## 5) 제거 방법

- `uninstall-service.bat`를 관리자 권한으로 실행

## 장애 시 체크 포인트

- 인터넷 단절 시 `queueCount` 증가 여부 확인
- 복구 후 `queueCount` 감소 및 `lastFlushSuccessAt` 갱신 확인
- `settings.json`의 백엔드 URL·API 키·HMAC·추적 폴더 경로 재확인
