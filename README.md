# 유현건설 계측 데이터 수집 플랫폼

현장 PC의 TXT append 데이터를 `agent`가 수집하고, `backend`의 수집 API로 안전하게 전송하는 1차 MVP 저장소입니다.

## 폴더 구조

- `backend`: NestJS 수집 API (`POST /api/ingest`, `GET /api/health`)
- `agent`: Node.js 수집 에이전트 (tail 방식 + SQLite 큐 + 재시도 전송)

## 빠른 시작

### 1) Backend 실행

```bash
cd backend
cp .env.example .env
npm install
npm run start:dev
```

### 2) Agent 실행

```bash
cd agent
cp .env.example .env
npm install
npm run dev
```

`agent/sample-data`에 `.txt` 파일을 만들고 줄을 추가하면 자동으로 큐 적재 후 백엔드로 전송됩니다.
