# 현장 PC 설치 가이드 (Windows 11)

## 0) 준비 파일

- `agent.exe`
- `agent-config.exe`
- `scripts/install-service.bat`
- `scripts/uninstall-service.bat`
- `nssm.exe` (같은 폴더 또는 `tools` 폴더)

권장 폴더:

- `C:\YuhyunAgent`

## 1) 기본 설정 입력

1. `agent-config.exe` 실행
2. 백엔드 URL 입력
   - 예: `https://<백엔드주소>/api/ingest`
3. API Key / HMAC Secret 입력
4. Site ID / Agent ID 입력
5. 추적 폴더 선택 및 필요 시 추가
6. 등록된 폴더 목록 확인/삭제
7. 저장 완료 메시지 확인

설정은 `settings.json`에 저장됩니다.

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
- `settings.json`의 백엔드 URL/API키/시크릿 오타 여부 재확인
