import { useEffect } from 'react'
import type { FeatureModalId, ModalSubTabId } from '@/adapters/dashboard.types'

const FEATURE_TITLE: Record<FeatureModalId, string> = {
  users: '사용자관리',
  permissions: '권한',
  equipment: '장비설정',
  logs: '로그',
}

const SUBTABS: { id: ModalSubTabId; label: string }[] = [
  { id: 'user', label: '사용자' },
  { id: 'permission', label: '권한' },
  { id: 'settings', label: '설정' },
  { id: 'log', label: '로그' },
]

const MOCK_ROWS: Record<FeatureModalId, { id: string; name: string; role: string; status: string }[]> = {
  users: [
    { id: 'admin', name: '관리자', role: 'Administrator', status: '활성' },
    { id: 'user01', name: '홍길동', role: 'Monitor', status: '활성' },
    { id: 'user02', name: '김현장', role: 'Operator', status: '휴면' },
  ],
  permissions: [
    { id: 'p1', name: '대시보드 조회', role: 'READ', status: '적용' },
    { id: 'p2', name: '설정 변경', role: 'WRITE', status: '제한' },
    { id: 'p3', name: '파일 다운로드', role: 'READ', status: '적용' },
  ],
  equipment: [
    { id: 'e1', name: 'MUX-01', role: '온라인', status: '정상' },
    { id: 'e2', name: '로거 A12', role: '지연', status: '점검' },
    { id: 'e3', name: '게이트웨이', role: '온라인', status: '정상' },
  ],
  logs: [
    { id: 'l1', name: '시스템', role: 'BOOT', status: '성공' },
    { id: 'l2', name: '수집', role: 'INGEST', status: '성공' },
    { id: 'l3', name: '알림', role: 'ALERT', status: '경고' },
  ],
}

export function FeatureModal(props: {
  open: boolean
  feature: FeatureModalId
  subTab: ModalSubTabId
  onClose: () => void
  onSubTabChange: (t: ModalSubTabId) => void
}) {
  const { open, feature, subTab, onClose, onSubTabChange } = props

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  const rows = MOCK_ROWS[feature]

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="feature-modal-title"
        className="flex max-h-[min(88dvh,880px)] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-zinc-200/80 bg-white shadow-2xl shadow-zinc-900/10"
      >
        <div className="flex items-center justify-between border-b border-zinc-100 px-5 py-4">
          <h2 id="feature-modal-title" className="text-lg font-semibold text-zinc-900">
            {FEATURE_TITLE[feature]}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-sm text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800"
          >
            닫기
          </button>
        </div>

        <div className="flex gap-1 border-b border-zinc-100 px-4 pt-3">
          {SUBTABS.map((t) => {
            const active = t.id === subTab
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => onSubTabChange(t.id)}
                className={
                  active
                    ? '-mb-px rounded-t-lg border border-b-white border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-900'
                    : 'rounded-t-lg px-3 py-2 text-sm font-medium text-zinc-500 hover:bg-zinc-50 hover:text-zinc-800'
                }
              >
                {t.label}
              </button>
            )
          })}
        </div>

        <div className="grid min-h-[420px] grid-cols-1 gap-4 overflow-auto p-4 lg:grid-cols-[1fr_280px]">
          <div className="flex min-h-0 flex-col gap-3">
            <div className="flex flex-wrap gap-2">
              <input
                type="search"
                placeholder="검색"
                className="min-w-[160px] flex-1 rounded-xl border border-zinc-200 bg-zinc-50/60 px-3 py-2 text-sm outline-none ring-0 focus:border-zinc-300 focus:bg-white"
              />
              <select className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-700">
                <option>역할 전체</option>
                <option>Administrator</option>
                <option>Operator</option>
              </select>
              <select className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-700">
                <option>상태 전체</option>
                <option>활성</option>
                <option>휴면</option>
              </select>
            </div>

            <div className="min-h-0 flex-1 overflow-auto rounded-xl border border-zinc-200">
              <table className="w-full min-w-[520px] border-collapse text-left text-sm">
                <thead className="sticky top-0 bg-zinc-50 text-xs font-medium uppercase tracking-wide text-zinc-500">
                  <tr>
                    <th className="border-b border-zinc-200 px-3 py-2">식별</th>
                    <th className="border-b border-zinc-200 px-3 py-2">이름</th>
                    <th className="border-b border-zinc-200 px-3 py-2">역할/유형</th>
                    <th className="border-b border-zinc-200 px-3 py-2">상태</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id} className="hover:bg-zinc-50/80">
                      <td className="border-b border-zinc-100 px-3 py-2 font-mono text-xs text-zinc-600">
                        {r.id}
                      </td>
                      <td className="border-b border-zinc-100 px-3 py-2 text-zinc-900">{r.name}</td>
                      <td className="border-b border-zinc-100 px-3 py-2 text-zinc-700">{r.role}</td>
                      <td className="border-b border-zinc-100 px-3 py-2 text-zinc-700">{r.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <aside className="rounded-xl border border-zinc-200 bg-zinc-50/50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">상세</p>
            <p className="mt-2 text-sm text-zinc-600">
              선택한 항목의 세부 정보가 여기에 표시됩니다. (임시 · 백엔드 연동 시 교체)
            </p>
            <div className="mt-4 space-y-2">
              <div className="h-2 rounded-full bg-zinc-200/80" />
              <div className="h-2 rounded-full bg-zinc-200/60" />
              <div className="h-2 w-2/3 rounded-full bg-zinc-200/60" />
            </div>
          </aside>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-zinc-100 px-4 py-3">
          <button
            type="button"
            className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-800 hover:bg-zinc-50"
          >
            추가
          </button>
          <button
            type="button"
            className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-800 hover:bg-zinc-50"
          >
            수정
          </button>
          <button
            type="button"
            className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-800 hover:bg-zinc-50"
          >
            삭제
          </button>
        </div>
      </div>
    </div>
  )
}
