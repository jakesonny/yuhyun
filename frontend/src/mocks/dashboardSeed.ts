import type { DashboardSnapshot, TreeNode } from '@/adapters/dashboard.types'

export const MOCK_TREE: TreeNode[] = [
  {
    id: 'sys-root',
    label: '통합계측관리시스템',
    children: [
      { id: 'site-geumdan', label: '검단 오수펌프장 가시설' },
      {
        id: 'site-seocho',
        label: '서초동 업무시설(백암빌딩) 개발사업',
        children: [
          { id: 'site-seocho-auto', label: '자동화 계측 모니터링 시스템' },
        ],
      },
      { id: 'site-pangyo', label: '판교제2테크노밸리 G1-1BL 업무시설 신축공사' },
    ],
  },
]

export const MOCK_DASHBOARDS: Record<string, DashboardSnapshot> = {
  'site-geumdan': {
    projectName: '검단 오수펌프장 가시설',
    siteTitle: '검단 오수펌프장 가시설',
    updatedAtLabel: '2024-03-19 19:35:01',
    kpis: [
      { id: 'k1', label: '정상 구간', value: '35', tone: 'success' },
      { id: 'k2', label: '주의', value: '3', tone: 'warning' },
      { id: 'k3', label: '경고', value: '1', tone: 'danger' },
      { id: 'k4', label: '수신률', value: '99.9%', tone: 'neutral' },
    ],
    media: [
      {
        id: 'm1',
        title: '현장 항공 영상',
        previewClass: 'bg-gradient-to-br from-sky-100 to-slate-200',
      },
    ],
    alerts: [
      {
        id: 'a1',
        time: '19:21:12',
        message: 'INC-04 관리기준 2차 상한 초과 (14.28mm)',
        level: 'danger',
      },
      {
        id: 'a2',
        time: '18:55:02',
        message: '데이터 지연 감지 — MUX-02',
        level: 'warning',
      },
      {
        id: 'a3',
        time: '18:02:41',
        message: '일일 점검 완료',
        level: 'info',
      },
    ],
    logLines: [
      { time: '19:35:01', message: '실시간 수신 정상 · 배치 검증 완료' },
      { time: '19:21:12', message: '알람: 2차 관리기준 초과 (INC-04)' },
      { time: '18:44:09', message: '로거 상태 점검 OK' },
    ],
  },
  'site-seocho-auto': {
    projectName: '서초동 업무시설(백암빌딩) 개발사업',
    siteTitle: '자동화 계측 모니터링 시스템',
    updatedAtLabel: '2025-04-10 15:20:50',
    kpis: [
      { id: 'k1', label: 'PPV 최대', value: '2.4 mm/s', tone: 'neutral' },
      { id: 'k2', label: '활성 노드', value: '12', tone: 'success' },
      { id: 'k3', label: '미확인', value: '0', tone: 'warning' },
      { id: 'k4', label: '수신률', value: '100%', tone: 'neutral' },
    ],
    media: [
      {
        id: 'm1',
        title: '건물 조감도',
        previewClass: 'bg-gradient-to-br from-stone-100 to-zinc-300',
      },
      {
        id: 'm2',
        title: '설치면 상세',
        previewClass: 'bg-gradient-to-br from-emerald-50 to-teal-100',
      },
      {
        id: 'm3',
        title: '층별 도면',
        previewClass: 'bg-gradient-to-br from-amber-50 to-orange-100',
      },
    ],
    alerts: [
      {
        id: 'a1',
        time: '15:20:50',
        message: 'PPV-X/Y/Z 정상 유지',
        level: 'info',
      },
      {
        id: 'a2',
        time: '14:08:11',
        message: '임계치 근접 — WL-02',
        level: 'warning',
      },
    ],
    logLines: [
      { time: '15:20:50', message: 'PPV-X · 정상' },
      { time: '15:20:50', message: 'PPV-Y · 정상' },
      { time: '15:20:50', message: 'PPV-Z · 정상' },
    ],
  },
  'site-pangyo': {
    projectName: '판교제2테크노밸리 G1-1BL 업무시설 신축공사',
    siteTitle: '판교제2테크노밸리 G1-1BL 업무시설 신축공사',
    updatedAtLabel: '2024-11-13 08:00:00',
    kpis: [
      { id: 'k1', label: '센서 수', value: '48', tone: 'neutral' },
      { id: 'k2', label: '주의', value: '2', tone: 'warning' },
      { id: 'k3', label: '경고', value: '1', tone: 'danger' },
      { id: 'k4', label: '수신률', value: '98.2%', tone: 'neutral' },
    ],
    media: [
      {
        id: 'm1',
        title: '평면도 오버레이',
        previewClass: 'bg-gradient-to-br from-slate-100 to-blue-100',
      },
    ],
    alerts: [
      {
        id: 'a1',
        time: '07:58:02',
        message: '2차 관리기준 초과 구간 발생',
        level: 'danger',
      },
    ],
    logLines: [
      { time: '18:00:24', message: '계측일시 11-13 08:00:00 반영' },
      { time: '08:00:00', message: '구간: 자동화모니터링 계측시스템' },
    ],
  },
}
